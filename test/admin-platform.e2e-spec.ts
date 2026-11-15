import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserInvited } from '../src/shared/contracts/events';
import {
  adminSession,
  auth,
  login,
  register,
  Session,
  uniqueEmail,
} from './support/api';
import { createTestApp, TestContext } from './support/test-app';

// Long end-to-end journeys (many sign-ups with bcrypt) need headroom on busy CI.
jest.setTimeout(180_000);

/** The ATUPA admin console (Admin Platform PRD, M-01 to M-29, S-01). */
describe('Admin platform (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;
  let support: Session;
  let creator: Session;
  const inviteTokens = new Map<string, string>();

  const http = () => ctx.http();

  /** Super admin invites a staff member, who sets a password from the email. */
  const createStaff = async (role: string): Promise<Session> => {
    const email = uniqueEmail(role);
    await http()
      .post('/api/v1/admin/users')
      .set(auth(admin))
      .send({ email, role, firstName: 'Staff', lastName: role })
      .expect(201);
    await http()
      .post('/api/v1/auth/password/reset')
      .send({ token: inviteTokens.get(email), newPassword: 'Passw0rd!' })
      .expect(200);
    return login(ctx, email, 'Passw0rd!');
  };

  const upload = async (s: Session, purpose: string) =>
    (
      await http()
        .post('/api/v1/media/upload')
        .set(auth(s))
        .field('purpose', purpose)
        .attach('file', Buffer.from('fake-image-bytes'), {
          filename: 'scan.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body.data as { id: string; url: string };

  const verifyTeacher = (teacher: Session) =>
    http()
      .post(`/api/v1/admin/users/${teacher.userId}/verification`)
      .set(auth(admin))
      .send({ decision: 'approve' })
      .expect(200);

  /** A teacher course with one published lesson. */
  const teacherCourse = async (teacher: Session, title: string) => {
    const course = (
      await http()
        .post('/api/v1/authoring/courses')
        .set(auth(teacher))
        .send({ languageCode: 'yoruba', level: 'beginner', title })
        .expect(201)
    ).body.data;
    const mod = (
      await http()
        .post(`/api/v1/authoring/courses/${course.id}/modules`)
        .set(auth(teacher))
        .send({ title: 'Module 1' })
        .expect(201)
    ).body.data;
    const lesson = (
      await http()
        .post(`/api/v1/authoring/modules/${mod.id}/lessons`)
        .set(auth(teacher))
        .send({ title: 'Lesson 1', blocks: [{ type: 'text', content: 'Hi' }] })
        .expect(201)
    ).body.data;
    await http()
      .post(`/api/v1/authoring/lessons/${lesson.id}/publish`)
      .set(auth(teacher))
      .expect(200);
    const published = await http()
      .post(`/api/v1/authoring/courses/${course.id}/publish`)
      .set(auth(teacher))
      .expect(200);
    return { course: published.body.data, lessonId: lesson.id as string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.app.get(EventEmitter2).on(UserInvited.NAME, (e: UserInvited) => {
      inviteTokens.set(e.email, e.setPasswordToken);
    });
    admin = await adminSession(ctx);
    support = await createStaff('support_admin');
    creator = await createStaff('content_creator');
  }, 120_000);

  afterAll(() => ctx?.close());

  describe('roles and access (M-02, M-03, M-05, M-07)', () => {
    it('returns a role-based menu for each admin role', async () => {
      const superMenu = await http()
        .get('/api/v1/admin/me/permissions')
        .set(auth(admin))
        .expect(200);
      expect(superMenu.body.data.permissions).toContain('plans.manage');
      const supportMenu = await http()
        .get('/api/v1/admin/me/permissions')
        .set(auth(support))
        .expect(200);
      expect(supportMenu.body.data.role).toBe('support_admin');
      expect(
        supportMenu.body.data.menu.map((m: { key: string }) => m.key),
      ).toEqual(expect.arrayContaining(['users', 'classes', 'reports']));
      expect(supportMenu.body.data.permissions).not.toContain('plans.manage');
      const learner = await register(ctx, 'learner');
      await http()
        .get('/api/v1/admin/me/permissions')
        .set(auth(learner))
        .expect(403);
    });

    it('lets support admins find users and help with access, not manage staff', async () => {
      const teacher = await register(ctx, 'teacher');
      const list = await http()
        .get('/api/v1/admin/users?role=teacher&isActive=true')
        .set(auth(support))
        .expect(200);
      expect(list.body.data.total).toBeGreaterThan(0);
      const link = await http()
        .post(`/api/v1/admin/users/${teacher.userId}/access-link`)
        .set(auth(support))
        .expect(200);
      expect(link.body.data.sent).toBe('password_reset');
      await http()
        .post('/api/v1/admin/users')
        .set(auth(support))
        .send({
          email: uniqueEmail('x'),
          role: 'super_admin',
          firstName: 'No',
        })
        .expect(403);
      await http()
        .patch(`/api/v1/admin/users/${teacher.userId}`)
        .set(auth(support))
        .send({ isActive: false })
        .expect(403);
      await http()
        .post(`/api/v1/admin/users/${admin.userId}/access-link`)
        .set(auth(support))
        .expect(403);
    });

    it('protects the last super admin', async () => {
      await http()
        .patch(`/api/v1/admin/users/${admin.userId}`)
        .set(auth(admin))
        .send({ isActive: false })
        .expect(400);
    });

    it('shows one page about a user, including last login (M-04)', async () => {
      const learner = await register(ctx, 'learner');
      await login(ctx, learner.email, 'Passw0rd!');
      const res = await http()
        .get(`/api/v1/admin/users/${learner.userId}/overview`)
        .set(auth(support))
        .expect(200);
      expect(res.body.data).toMatchObject({
        user: { id: learner.userId, role: 'learner' },
        subscription: { planCode: 'free' },
        courses: [],
      });
      expect(res.body.data.lastLoginAt).toBeTruthy();
    });
  });

  describe('teacher verification (M-08, M-28)', () => {
    it('teacher sends documents; super admin approves', async () => {
      const teacher = await register(ctx, 'teacher');
      const me = await http()
        .get('/api/v1/users/me')
        .set(auth(teacher))
        .expect(200);
      expect(me.body.data.verificationStatus).toBe('unverified');

      const scan = await upload(teacher, 'verification');
      await http()
        .post('/api/v1/users/me/verification')
        .set(auth(teacher))
        .send({
          documents: [{ mediaId: scan.id, label: 'TRCN certificate' }],
          note: 'TRCN 12345',
        })
        .expect(201);

      const queue = await http()
        .get('/api/v1/admin/verifications?type=teacher&status=pending')
        .set(auth(admin))
        .expect(200);
      const entry = queue.body.data.items.find(
        (i: { id: string }) => i.id === teacher.userId,
      );
      expect(entry.verification.documents[0]).toMatchObject({
        label: 'TRCN certificate',
      });

      // Other learners cannot open the private document.
      const learner = await register(ctx, 'learner');
      await http()
        .get(`/api/v1/media/${scan.id}/playback`)
        .set(auth(learner))
        .expect(403);

      const approved = await http()
        .post(`/api/v1/admin/users/${teacher.userId}/verification`)
        .set(auth(admin))
        .send({ decision: 'approve' })
        .expect(200);
      expect(approved.body.data.verificationStatus).toBe('verified');
    });

    it('rejecting a teacher blocks sign-in and needs a reason', async () => {
      const teacher = await register(ctx, 'teacher');
      await http()
        .post(`/api/v1/admin/users/${teacher.userId}/verification`)
        .set(auth(admin))
        .send({ decision: 'reject' })
        .expect(400);
      await http()
        .post(`/api/v1/admin/users/${teacher.userId}/verification`)
        .set(auth(admin))
        .send({ decision: 'reject', reason: 'No agreement signed with ATUPA' })
        .expect(200);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: teacher.email, password: 'Passw0rd!' })
        .expect(401);
    });
  });

  describe('content review (M-19)', () => {
    it('ATUPA content waits for a super admin before learners see it', async () => {
      const course = (
        await http()
          .post('/api/v1/authoring/courses')
          .set(auth(creator))
          .send({
            languageCode: 'igbo',
            level: 'beginner',
            title: 'Reviewed Igbo Greetings',
          })
          .expect(201)
      ).body.data;
      expect(course).toMatchObject({
        ownerType: 'atupa',
        visibility: 'public',
      });
      const mod = (
        await http()
          .post(`/api/v1/authoring/courses/${course.id}/modules`)
          .set(auth(creator))
          .send({ title: 'Module 1' })
          .expect(201)
      ).body.data;
      const lesson = (
        await http()
          .post(`/api/v1/authoring/modules/${mod.id}/lessons`)
          .set(auth(creator))
          .send({ title: 'Ndewo', blocks: [{ type: 'text', content: 'Hi' }] })
          .expect(201)
      ).body.data;

      const lessonRes = await http()
        .post(`/api/v1/authoring/lessons/${lesson.id}/publish`)
        .set(auth(creator))
        .expect(200);
      expect(lessonRes.body.message).toBe('Lesson submitted for review');
      expect(lessonRes.body.data.status).toBe('in_review');
      const courseRes = await http()
        .post(`/api/v1/authoring/courses/${course.id}/publish`)
        .set(auth(creator))
        .expect(200);
      expect(courseRes.body.data).toMatchObject({
        status: 'in_review',
        submittedForReview: true,
      });

      const hidden = await http()
        .get('/api/v1/courses?q=Reviewed Igbo')
        .expect(200);
      expect(hidden.body.data.total).toBe(0);

      const queue = await http()
        .get('/api/v1/admin/reviews')
        .set(auth(admin))
        .expect(200);
      expect(
        queue.body.data.courses.find((c: { id: string }) => c.id === course.id),
      ).toMatchObject({ submittedBy: { id: creator.userId } });
      await http().get('/api/v1/admin/reviews').set(auth(creator)).expect(403);

      await http()
        .post(`/api/v1/admin/reviews/courses/${course.id}`)
        .set(auth(admin))
        .send({ decision: 'approve' })
        .expect(200);
      const live = await http()
        .get('/api/v1/courses?q=Reviewed Igbo')
        .expect(200);
      expect(live.body.data.items[0]).toMatchObject({
        id: course.id,
        byAtupa: true,
        author: { name: 'ATUPA' },
      });
      const outline = await http()
        .get(`/api/v1/courses/${course.id}`)
        .expect(200);
      expect(outline.body.data.totals.lessons).toBe(1);
    });

    it('rejected lessons go back to draft with a comment', async () => {
      const course = (
        await http()
          .post('/api/v1/authoring/courses')
          .set(auth(support))
          .send({ languageCode: 'hausa', level: 'beginner', title: 'Hausa 2' })
          .expect(201)
      ).body.data;
      const mod = (
        await http()
          .post(`/api/v1/authoring/courses/${course.id}/modules`)
          .set(auth(support))
          .send({ title: 'M' })
          .expect(201)
      ).body.data;
      const lesson = (
        await http()
          .post(`/api/v1/authoring/modules/${mod.id}/lessons`)
          .set(auth(support))
          .send({ title: 'Sannu' })
          .expect(201)
      ).body.data;
      await http()
        .post(`/api/v1/authoring/lessons/${lesson.id}/publish`)
        .set(auth(support))
        .expect(200);
      await http()
        .post(`/api/v1/admin/reviews/lessons/${lesson.id}`)
        .set(auth(admin))
        .send({ decision: 'reject' })
        .expect(400);
      const rejected = await http()
        .post(`/api/v1/admin/reviews/lessons/${lesson.id}`)
        .set(auth(admin))
        .send({ decision: 'reject', comment: 'Add the audio first' })
        .expect(200);
      expect(rejected.body.data).toMatchObject({
        status: 'draft',
        review: { decision: 'rejected', comment: 'Add the audio first' },
      });
    });

    it('library content from staff also waits for review', async () => {
      const entry = await http()
        .post('/api/v1/authoring/vocabulary')
        .set(auth(creator))
        .send({
          languageCode: 'yoruba',
          term: 'Ọ̀rẹ́',
          meaning: 'Friend',
          conceptKey: 'friend_review_test',
        })
        .expect(201);
      expect(entry.body.data.status).toBe('in_review');
      const queue = await http()
        .get('/api/v1/admin/reviews')
        .set(auth(admin))
        .expect(200);
      expect(
        queue.body.data.library.some(
          (i: { id: string }) => i.id === entry.body.data.id,
        ),
      ).toBe(true);
      const approved = await http()
        .post(`/api/v1/admin/reviews/library/vocabulary/${entry.body.data.id}`)
        .set(auth(admin))
        .send({ decision: 'approve' })
        .expect(200);
      expect(approved.body.data.status).toBe('published');
    });
  });

  describe('course visibility (M-25)', () => {
    it('teacher courses are Private: only class learners can take them', async () => {
      const teacher = await register(ctx, 'teacher');
      const { course, lessonId } = await teacherCourse(
        teacher,
        'Private Yoruba Club',
      );
      expect(course.visibility).toBe('private');

      const outsider = await register(ctx, 'learner');
      const listed = await http()
        .get('/api/v1/courses?q=Private Yoruba Club')
        .expect(200);
      expect(listed.body.data.total).toBe(0);
      await http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(outsider))
        .expect(403);
      await http()
        .post(`/api/v1/progress/courses/${course.id}/enroll`)
        .set(auth(outsider))
        .expect(403);

      const classroom = (
        await http()
          .post('/api/v1/classes')
          .set(auth(teacher))
          .send({ name: 'Saturday club' })
          .expect(201)
      ).body.data;
      await http()
        .post(`/api/v1/classes/${classroom.id}/courses/${course.id}`)
        .set(auth(teacher))
        .expect(201);
      const member = await register(ctx, 'learner');
      await http()
        .post('/api/v1/classes/join')
        .set(auth(member))
        .send({ code: classroom.joinCode })
        .expect(200);
      await http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(member))
        .expect(200);

      // Another teacher cannot borrow this private course for their class.
      const other = await register(ctx, 'teacher');
      const otherClass = (
        await http()
          .post('/api/v1/classes')
          .set(auth(other))
          .send({ name: 'Other' })
          .expect(201)
      ).body.data;
      await http()
        .post(`/api/v1/classes/${otherClass.id}/courses/${course.id}`)
        .set(auth(other))
        .expect(403);
    });

    it('Public needs a verified teacher and approval; admins can take it back', async () => {
      const teacher = await register(ctx, 'teacher');
      const { course, lessonId } = await teacherCourse(
        teacher,
        'Public Yoruba Songs',
      );
      await http()
        .patch(`/api/v1/authoring/courses/${course.id}/visibility`)
        .set(auth(teacher))
        .send({ visibility: 'public' })
        .expect(403);

      await verifyTeacher(teacher);
      const requested = await http()
        .patch(`/api/v1/authoring/courses/${course.id}/visibility`)
        .set(auth(teacher))
        .send({ visibility: 'public' })
        .expect(200);
      expect(requested.body.data).toMatchObject({
        visibility: 'private',
        requestedPublic: true,
        publicRequest: { status: 'pending' },
      });

      await http()
        .post(`/api/v1/admin/reviews/courses/${course.id}/visibility`)
        .set(auth(admin))
        .send({ decision: 'approve' })
        .expect(200);
      const listed = await http()
        .get('/api/v1/courses?q=Public Yoruba Songs')
        .expect(200);
      expect(listed.body.data.items[0]).toMatchObject({
        visibility: 'public',
        byAtupa: false,
        author: { id: teacher.userId, isVerified: true },
      });

      // A learner enrolls, then ATUPA makes the course Private again.
      const learner = await register(ctx, 'learner');
      await http()
        .post(`/api/v1/progress/courses/${course.id}/enroll`)
        .set(auth(learner))
        .expect(201);
      await http()
        .patch(`/api/v1/admin/courses/${course.id}/visibility`)
        .set(auth(admin))
        .send({ visibility: 'private', reason: 'Needs better audio' })
        .expect(200);
      const gone = await http()
        .get('/api/v1/courses?q=Public Yoruba Songs')
        .expect(200);
      expect(gone.body.data.total).toBe(0);
      // Learners already enrolled keep access.
      await http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(learner))
        .expect(200);
      const notes = await http()
        .get('/api/v1/notifications')
        .set(auth(teacher))
        .expect(200);
      expect(JSON.stringify(notes.body.data)).toContain('Needs better audio');
    });
  });

  describe('classes and bulk upload (M-10, M-11, M-12, M-22)', () => {
    let classId: string;
    let teacher: Session;

    it('support admin creates a class for any teacher', async () => {
      teacher = await register(ctx, 'teacher');
      const res = await http()
        .post('/api/v1/classes')
        .set(auth(support))
        .send({ name: 'Beginner class', teacherUserId: teacher.userId })
        .expect(201);
      classId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        teacherUserId: teacher.userId,
        schoolId: null,
      });
    });

    it('checks the CSV first, then saves and adds learners to the class', async () => {
      const bad = [
        'First Name,Last Name,Email,Date of Birth,Language',
        'Ada,Obi,not-an-email,2014-05-20,yoruba',
        ',Bello,b@x.test,2030-01-01,klingon',
      ].join('\n');
      const checked = await http()
        .post('/api/v1/admin/learners/bulk')
        .set(auth(support))
        .attach('file', Buffer.from(bad), 'learners.csv')
        .expect(201);
      expect(checked.body.data).toMatchObject({
        saved: false,
        total: 2,
        failed: 2,
      });
      expect(checked.body.data.rows[0].errors).toContain('Email is not valid');
      expect(checked.body.data.rows[1].errors).toEqual(
        expect.arrayContaining([
          'First name is required',
          'Date of birth cannot be in the future',
          'Unknown language "klingon"',
        ]),
      );

      const emails = [uniqueEmail('bulk'), uniqueEmail('bulk')];
      const good = [
        'firstName,lastName,email,dateOfBirth,preferredLanguageCode',
        `Chidi,Okeke,${emails[0]},2013-02-11,igbo`,
        `"Amina, A.",Bello,${emails[1]},2012-09-30,hausa`,
      ].join('\n');
      const dry = await http()
        .post('/api/v1/admin/learners/bulk')
        .set(auth(support))
        .attach('file', Buffer.from(good), 'learners.csv')
        .expect(201);
      expect(dry.body.data).toMatchObject({ saved: false, valid: 2 });
      const saved = await http()
        .post('/api/v1/admin/learners/bulk')
        .set(auth(support))
        .field('dryRun', 'false')
        .field('classId', classId)
        .attach('file', Buffer.from(good), 'learners.csv')
        .expect(201);
      expect(saved.body.data).toMatchObject({
        saved: true,
        created: 2,
        addedToClass: 2,
      });
      expect(inviteTokens.has(emails[0])).toBe(true);
    });

    it('support admin sees the learners report and can download it', async () => {
      const report = await http()
        .get(`/api/v1/reports/classes/${classId}`)
        .set(auth(support))
        .expect(200);
      expect(report.body.data.learners).toHaveLength(2);
      const csv = await http()
        .get(`/api/v1/admin/exports/classes/${classId}/report`)
        .set(auth(support))
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text.split('\r\n')[0]).toContain('Learner');
      const pdf = await http()
        .get(`/api/v1/admin/exports/classes/${classId}/report?format=pdf`)
        .set(auth(support))
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('plans, subscriptions and payments (S-01, M-20, M-21)', () => {
    it('super admin edits tiered plans; the free plan stays free', async () => {
      const created = await http()
        .post('/api/v1/admin/plans')
        .set(auth(admin))
        .send({
          code: 'family_premium',
          label: 'Family Premium',
          tier: 2,
          amountKobo: 800_000,
          periodDays: 30,
          ownerType: 'user',
          features: ['Up to 4 children'],
        })
        .expect(201);
      expect(created.body.data).toMatchObject({ tier: 2, isActive: true });
      await http()
        .patch('/api/v1/admin/plans/family_premium')
        .set(auth(admin))
        .send({ amountKobo: 900_000 })
        .expect(200);
      await http()
        .patch('/api/v1/admin/plans/free')
        .set(auth(admin))
        .send({ amountKobo: 100 })
        .expect(400);
      const publicPlans = await http()
        .get('/api/v1/subscriptions/plans')
        .expect(200);
      expect(
        publicPlans.body.data.find(
          (p: { code: string }) => p.code === 'family_premium',
        ),
      ).toMatchObject({ amountKobo: 900_000 });
      await http()
        .post('/api/v1/admin/plans')
        .set(auth(support))
        .send({})
        .expect(403);
    });

    it('manual grants are limited and recorded', async () => {
      const learner = await register(ctx, 'learner');
      await http()
        .post('/api/v1/admin/subscriptions/grant')
        .set(auth(admin))
        .send({
          ownerType: 'user',
          ownerId: learner.userId,
          planCode: 'individual_premium',
          days: 400,
          reason: 'Too long',
        })
        .expect(400);
      const granted = await http()
        .post('/api/v1/admin/subscriptions/grant')
        .set(auth(admin))
        .send({
          ownerType: 'user',
          ownerId: learner.userId,
          planCode: 'individual_premium',
          days: 30,
          reason: 'Refund for failed payment',
        })
        .expect(200);
      expect(granted.body.data).toMatchObject({
        status: 'active',
        lastManualChange: { action: 'grant', days: 30 },
      });
      const mine = await http()
        .get('/api/v1/subscriptions/mine')
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data).toMatchObject({ hasPremiumAccess: true, tier: 1 });

      const list = await http()
        .get(`/api/v1/admin/subscriptions?ownerId=${learner.userId}`)
        .set(auth(admin))
        .expect(200);
      expect(list.body.data.total).toBe(1);
      await http()
        .post('/api/v1/admin/subscriptions/cancel')
        .set(auth(admin))
        .send({
          ownerType: 'user',
          ownerId: learner.userId,
          reason: 'Asked to stop',
        })
        .expect(200);
      const after = await http()
        .get('/api/v1/subscriptions/mine')
        .set(auth(learner))
        .expect(200);
      expect(after.body.data.hasPremiumAccess).toBe(false);

      await http()
        .get('/api/v1/admin/payments?status=failed&from=2026-01-01')
        .set(auth(admin))
        .expect(200);
      await http()
        .get('/api/v1/admin/exports/payments.csv')
        .set(auth(support))
        .expect(403);
    });
  });

  describe('trust and safety (M-26, M-27, M-29)', () => {
    it('learner reports a teacher; admins handle it from the queue', async () => {
      const teacher = await register(ctx, 'teacher');
      const learner = await register(ctx, 'learner');
      const screenshot = await upload(learner, 'report');
      const filed = await http()
        .post('/api/v1/safety-reports')
        .set(auth(learner))
        .send({
          targetType: 'teacher',
          targetId: teacher.userId,
          reason: 'asking_for_money_or_details',
          note: 'Asked for my mum’s bank PIN',
          attachmentIds: [screenshot.id],
        })
        .expect(201);
      const reference = filed.body.data.reference as string;
      expect(reference).toMatch(/^RPT-[A-Z0-9]{8}$/);
      expect(filed.body.message).toContain(reference);

      await http()
        .post('/api/v1/safety-reports')
        .set(auth(teacher))
        .send({
          targetType: 'teacher',
          targetId: teacher.userId,
          reason: 'other',
        })
        .expect(400);

      const queue = await http()
        .get('/api/v1/admin/safety-reports?unresolved=true')
        .set(auth(support))
        .expect(200);
      const first = queue.body.data.items[0];
      expect(first).toMatchObject({ reference, severity: 'critical' });
      const due =
        new Date(first.dueAt).getTime() - new Date(first.createdAt).getTime();
      expect(Math.round(due / 3_600_000)).toBe(24);

      await http()
        .post(`/api/v1/admin/safety-reports/${first.id}/assign`)
        .set(auth(admin))
        .send({ assigneeId: support.userId })
        .expect(200);
      await http()
        .post(`/api/v1/admin/safety-reports/${first.id}/comments`)
        .set(auth(support))
        .send({ body: 'Spoke to the parent' })
        .expect(201);
      await http()
        .post(`/api/v1/admin/safety-reports/${first.id}/resolve`)
        .set(auth(support))
        .send({ outcome: 'suspend_account' })
        .expect(403);
      await http()
        .post(`/api/v1/admin/safety-reports/${first.id}/resolve`)
        .set(auth(admin))
        .send({ outcome: 'hide_course' })
        .expect(400);
      const resolved = await http()
        .post(`/api/v1/admin/safety-reports/${first.id}/resolve`)
        .set(auth(admin))
        .send({ outcome: 'suspend_account', note: 'Confirmed by parent' })
        .expect(200);
      expect(resolved.body.data).toMatchObject({
        status: 'resolved',
        outcome: 'suspend_account',
      });
      await http()
        .post('/api/v1/auth/login')
        .send({ email: teacher.email, password: 'Passw0rd!' })
        .expect(401);

      const mine = await http()
        .get('/api/v1/safety-reports/mine')
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data.items[0]).toEqual(
        expect.objectContaining({ reference, handled: true }),
      );
      expect(JSON.stringify(mine.body.data)).not.toContain(
        'Spoke to the parent',
      );
      const notes = await http()
        .get('/api/v1/notifications')
        .set(auth(learner))
        .expect(200);
      expect(JSON.stringify(notes.body.data)).toContain(reference);
    });

    it('flags bank details in teacher lessons and repeated failed logins', async () => {
      const teacher = await register(ctx, 'teacher');
      const course = (
        await http()
          .post('/api/v1/authoring/courses')
          .set(auth(teacher))
          .send({ languageCode: 'yoruba', level: 'beginner', title: 'Extra' })
          .expect(201)
      ).body.data;
      const mod = (
        await http()
          .post(`/api/v1/authoring/courses/${course.id}/modules`)
          .set(auth(teacher))
          .send({ title: 'M' })
          .expect(201)
      ).body.data;
      await http()
        .post(`/api/v1/authoring/modules/${mod.id}/lessons`)
        .set(auth(teacher))
        .send({
          title: 'Pay first',
          blocks: [
            {
              type: 'text',
              content: 'Pay N5000 to GTBank account 0123456789 to continue',
            },
          ],
        })
        .expect(201);
      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/v1/auth/login')
          .send({ email: teacher.email, password: 'wrong-pass1' })
          .expect(401);
      }

      const alerts = await http()
        .get('/api/v1/admin/alerts?status=open')
        .set(auth(admin))
        .expect(200);
      const types = alerts.body.data.items.map(
        (a: { type: string; subjectId: string }) => `${a.type}:${a.subjectId}`,
      );
      expect(types).toContain(`failed_logins:${teacher.userId}`);
      const textAlert = alerts.body.data.items.find(
        (a: { type: string; details: { authorUserId: string } }) =>
          a.type === 'suspicious_text' &&
          a.details.authorUserId === teacher.userId,
      );
      expect(textAlert).toMatchObject({ severity: 'critical' });
      const handled = await http()
        .patch(`/api/v1/admin/alerts/${textAlert.id}`)
        .set(auth(admin))
        .send({ status: 'resolved', note: 'Lesson removed' })
        .expect(200);
      expect(handled.body.data).toMatchObject({
        status: 'resolved',
        handledByUserId: admin.userId,
      });
    });
  });

  describe('admin home and activity log (M-01, M-24)', () => {
    it('shows platform numbers and what needs attention', async () => {
      const res = await http()
        .get('/api/v1/admin/overview')
        .set(auth(admin))
        .expect(200);
      expect(res.body.data.users.byRole.support_admin).toBe(1);
      expect(res.body.data.engagement30d).toHaveProperty('quizPassRate');
      expect(res.body.data.needsAttention).toEqual(
        expect.objectContaining({
          contentReviews: expect.any(Number),
          openSafetyReports: expect.any(Number),
          openAlerts: expect.any(Number),
        }),
      );
      await http().get('/api/v1/admin/overview').set(auth(support)).expect(403);
    });

    it('records who did what, without secrets, and only for staff actions', async () => {
      const log = await http()
        .get('/api/v1/admin/activity-log?action=verification')
        .set(auth(admin))
        .expect(200);
      expect(log.body.data.items[0]).toMatchObject({
        actorId: admin.userId,
        actorRole: 'super_admin',
        action: 'admin.users.verification',
        method: 'POST',
      });
      // Learner actions (joining classes, filing reports...) are personal.
      const learners = await http()
        .get('/api/v1/admin/activity-log?actorRole=learner')
        .set(auth(admin))
        .expect(200);
      expect(learners.body.data.total).toBe(0);
      const csv = await http()
        .get('/api/v1/admin/exports/activity-log.csv')
        .set(auth(admin))
        .expect(200);
      expect(csv.text).not.toContain('Passw0rd!');
      await http()
        .get('/api/v1/admin/activity-log')
        .set(auth(support))
        .expect(403);
    });
  });
});
