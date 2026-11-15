import { TestContext } from './test-app';

let counter = 0;

export interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
}

export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@atupa.test`;
}

export async function register(
  ctx: TestContext,
  role: 'learner' | 'parent' | 'teacher',
  extra: Record<string, unknown> = {},
): Promise<Session> {
  const email = uniqueEmail(role);
  const profile =
    role === 'learner'
      ? {
          firstName: 'Ada',
          lastName: 'Obi',
          dateOfBirth: '2014-05-20',
          preferredLanguageCode: 'yoruba',
        }
      : role === 'teacher'
        ? {
            firstName: 'Tunde',
            lastName: 'Bello',
            phone: '+2348012345678',
            languageSpecializations: ['yoruba'],
          }
        : { firstName: 'Ngozi', lastName: 'Obi' };
  const res = await ctx
    .http()
    .post('/api/v1/auth/register')
    .send({ email, password: 'Passw0rd!', role, ...profile, ...extra })
    .expect(201);
  return toSession(res.body.data, email);
}

export async function login(
  ctx: TestContext,
  email: string,
  password: string,
): Promise<Session> {
  const res = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return toSession(res.body.data, email);
}

export function adminSession(ctx: TestContext) {
  return login(ctx, 'admin@atupa.test', 'AdminPass123');
}

function toSession(
  data: { accessToken: string; refreshToken: string; user: { id: string } },
  email: string,
) {
  return {
    token: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    email,
  };
}

export function auth(session: Session) {
  return { Authorization: `Bearer ${session.token}` };
}

export async function findCourse(
  ctx: TestContext,
  languageCode: string,
  level: string,
) {
  const res = await ctx
    .http()
    .get(`/api/v1/courses?languageCode=${languageCode}&level=${level}`)
    .expect(200);
  return res.body.data.items[0] as {
    id: string;
    title: string;
    isPremium: boolean;
  };
}

/**
 * Makes a teacher's published course Public the way it happens in the app:
 * an admin verifies the teacher, the teacher asks for Public, the admin
 * approves the request.
 */
export async function makeCoursePublic(
  ctx: TestContext,
  teacher: Session,
  courseId: string,
) {
  const admin = await adminSession(ctx);
  await ctx
    .http()
    .post(`/api/v1/admin/users/${teacher.userId}/verification`)
    .set(auth(admin))
    .send({ decision: 'approve' })
    .expect(200);
  await ctx
    .http()
    .patch(`/api/v1/authoring/courses/${courseId}/visibility`)
    .set(auth(teacher))
    .send({ visibility: 'public' })
    .expect(200);
  await ctx
    .http()
    .post(`/api/v1/admin/reviews/courses/${courseId}/visibility`)
    .set(auth(admin))
    .send({ decision: 'approve' })
    .expect(200);
}
