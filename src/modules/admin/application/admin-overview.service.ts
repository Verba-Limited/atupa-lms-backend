import { Injectable } from '@nestjs/common';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { displayName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService, ContentReviewService } from '../../catalog';
import { ClassesService } from '../../classes';
import { PublicUser, UsersService, VerificationStatus } from '../../identity';
import { ProgressQueryService } from '../../progress';
import { DashboardsService } from '../../reports';
import { AlertsService, SafetyReportsService } from '../../safety';
import { SchoolsService } from '../../schools';
import { SubscriptionsService } from '../../subscriptions';

/** Admin home (M-01), user detail (M-04) and the verification queue (M-28). */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly users: UsersService,
    private readonly schools: SchoolsService,
    private readonly review: ContentReviewService,
    private readonly catalog: CatalogQueryService,
    private readonly classes: ClassesService,
    private readonly progress: ProgressQueryService,
    private readonly subscriptions: SubscriptionsService,
    private readonly reports: SafetyReportsService,
    private readonly alerts: AlertsService,
  ) {}

  /** Platform numbers plus everything waiting for an admin. */
  async overview() {
    const [
      platform,
      pendingReviews,
      pendingTeachers,
      pendingSchools,
      openReports,
      criticalReports,
      openAlerts,
    ] = await Promise.all([
      this.dashboards.admin(),
      this.review.countPending(),
      this.users.list(
        {
          role: UserRole.TEACHER,
          verificationStatus: VerificationStatus.PENDING,
        },
        { page: 1, limit: 1 },
      ),
      this.schools.list(
        { verificationStatus: 'pending' },
        { page: 1, limit: 1 },
      ),
      this.reports.countOpen(),
      this.reports.countOpen({ severity: 'critical' }),
      this.alerts.count({ status: 'open' }),
    ]);
    return {
      ...platform,
      needsAttention: {
        contentReviews: pendingReviews,
        teacherVerifications: pendingTeachers.total,
        schoolVerifications: pendingSchools.total,
        openSafetyReports: openReports,
        criticalSafetyReports: criticalReports,
        openAlerts,
      },
    };
  }

  /** One page about a user: profile, school, plan, courses, progress, last login. */
  async userOverview(userId: string) {
    const user = await this.users.getById(userId);
    const [school, subscription, reportsAgainst] = await Promise.all([
      user.schoolId ? this.schools.findById(user.schoolId) : null,
      this.subscriptions.getForOwner('user', user.id),
      this.reports.countAgainst(user.id),
    ]);
    const base = {
      user,
      lastLoginAt: user.lastLoginAt ?? null,
      lastActiveAt: user.lastActiveAt ?? null,
      school: school
        ? { id: school.id, name: school.name, isActive: school.isActive }
        : null,
      subscription: subscription ?? { planCode: 'free', status: 'active' },
      safetyReportsAgainst: reportsAgainst,
    };
    if (user.role === UserRole.LEARNER) {
      const [stats, enrollments, classes] = await Promise.all([
        this.progress.getStats(user.id),
        this.progress.listEnrollments(user.id),
        this.classes.listForStudent(user.id),
      ]);
      const courses = await this.catalog.findCourses(
        enrollments.map((e) => e.courseId),
      );
      const titles = new Map(courses.map((c) => [c.id, c.title]));
      return {
        ...base,
        progress: {
          points: stats.totalPoints,
          streakDays: stats.streakDays,
          learningMinutes: stats.learningMinutes,
          counters: stats.counters,
        },
        courses: enrollments.map((e) => ({
          courseId: e.courseId,
          title: titles.get(e.courseId) ?? null,
          status: e.status,
          progressPercent: e.progressPercent,
          enrolledAt: e.enrolledAt,
        })),
        classes: classes.map((c) => ({ id: c.id, name: c.name })),
      };
    }
    if (user.role === UserRole.TEACHER) {
      const [classes, courses] = await Promise.all([
        this.classes.listForTeacher(user.id),
        this.review.listCourses(
          { createdByUserId: user.id },
          { page: 1, limit: 100 },
        ),
      ]);
      return {
        ...base,
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          students: c.studentUserIds.length,
        })),
        courses: courses.items.map((c) => ({
          courseId: c.id,
          title: c.title,
          status: c.status,
          visibility: c.visibility,
          publicRequest: c.publicRequest?.status ?? null,
        })),
      };
    }
    return base;
  }

  /** Teachers and schools waiting for (or past) a verification decision. */
  async verifications(
    type: 'teacher' | 'school',
    status: string,
    page: PageRequest,
  ): Promise<Page<Record<string, unknown>>> {
    if (type === 'school') {
      const result = await this.schools.list(
        { verificationStatus: status },
        page,
      );
      return {
        ...result,
        items: result.items.map((s) => ({
          type: 'school',
          id: s.id,
          name: s.name,
          email: s.email,
          region: s.region,
          isActive: s.isActive,
          verification: s.verification ?? { status: 'verified', documents: [] },
          createdAt: s.createdAt,
        })),
      };
    }
    const result = await this.users.list(
      {
        role: UserRole.TEACHER,
        verificationStatus: status as VerificationStatus,
      },
      page,
    );
    return {
      ...result,
      items: result.items.map((u: PublicUser) => ({
        type: 'teacher',
        id: u.id,
        name: displayName(u),
        email: u.email,
        phone: u.phone,
        languageSpecializations: u.languageSpecializations,
        teachingExperienceYears: u.teachingExperienceYears,
        isActive: u.isActive,
        verification: {
          status: u.verificationStatus,
          documents: u.verificationDocuments ?? [],
          note: u.verificationNote ?? null,
          submittedAt: u.verificationSubmittedAt ?? null,
          decidedAt: u.verifiedAt ?? null,
        },
        createdAt: u.createdAt,
      })),
    };
  }
}
