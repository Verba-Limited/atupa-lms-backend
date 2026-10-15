import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ContentStatus, LEVEL_ORDER } from '../../../shared/domain/enums';
import { ForbiddenError } from '../../../shared/domain/errors';
import { displayName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import { AssignmentsService } from '../../assignments';
import { CatalogQueryService } from '../../catalog';
import { CertificatesService } from '../../certificates';
import { ClassesService } from '../../classes';
import { GamecardService } from '../../gamecard';
import { UsersService } from '../../identity';
import { ParentsService } from '../../parents';
import { LearningEventType, ProgressQueryService } from '../../progress';
import { SchoolsService } from '../../schools';
import { SubscriptionsService } from '../../subscriptions';
import { LearnerAccessService } from './learner-access.service';
import { LearnerInsightsService } from './learner-insights.service';

const DAY = 86_400_000;

@Injectable()
export class DashboardsService {
  constructor(
    private readonly users: UsersService,
    private readonly progress: ProgressQueryService,
    private readonly catalog: CatalogQueryService,
    private readonly certificates: CertificatesService,
    private readonly classes: ClassesService,
    private readonly assignments: AssignmentsService,
    private readonly parents: ParentsService,
    private readonly schools: SchoolsService,
    private readonly gamecard: GamecardService,
    private readonly subscriptions: SubscriptionsService,
    private readonly access: LearnerAccessService,
    private readonly insights: LearnerInsightsService,
  ) {}

  /** PRD section 7. */
  async learner(actor: Actor) {
    const learner = await this.users.getById(actor.userId);
    const summary = await this.insights.summary(learner);
    const pending = await this.assignments.countSubmissionsByStatus({
      learnerIds: [learner.id],
    });
    return {
      welcomeMessage: `Welcome, ${learner.firstName ?? 'learner'}!`,
      ...summary,
      completedLessons: summary.counters.lessonsCompleted,
      badgeCount: summary.badges.length,
      pendingAssignments: (pending.assigned ?? 0) + (pending.started ?? 0),
      recommendedCourses: await this.recommendedCourses(
        learner.preferredLanguageCode,
        summary.courses.map((c) => ({
          courseId: c.courseId,
          languageCode: c.languageCode,
          level: c.level,
        })),
      ),
    };
  }

  /** PRD section 22: overview of every linked child. */
  async parent(actor: Actor) {
    const children = await this.parents.listChildren(actor.userId);
    return {
      children: await Promise.all(
        children.map((c) => this.insights.summary(c)),
      ),
    };
  }

  async child(actor: Actor, childId: string) {
    if (
      actor.role === UserRole.PARENT &&
      !(await this.parents.isParentOf(actor.userId, childId))
    ) {
      throw new ForbiddenError('This child is not linked to your account');
    }
    const child = await this.access.assertCanView(actor, childId);
    return {
      ...(await this.insights.summary(child)),
      teacherFeedback: await this.insights.teacherFeedback(childId),
    };
  }

  /** PRD section 18. */
  async teacher(actor: Actor) {
    const classes = await this.classes.listForTeacher(actor.userId);
    const studentIds = [...new Set(classes.flatMap((c) => c.studentUserIds))];
    const since = new Date(Date.now() - 7 * DAY);
    const [
      activeStudents,
      authoredCourses,
      assignmentCount,
      statusCounts,
      avg,
      events,
      recentQuiz,
    ] = await Promise.all([
      studentIds.length
        ? this.progress.countActiveLearners({ since, userIds: studentIds })
        : 0,
      this.catalog.countCourses({ createdByUserId: actor.userId }),
      this.assignments.countAssignments({
        classroomIds: classes.map((c) => c.id),
      }),
      studentIds.length
        ? this.assignments.countSubmissionsByStatus({ learnerIds: studentIds })
        : {},
      studentIds.length
        ? this.progress.averageQuizScore(studentIds)
        : { average: 0, count: 0 },
      studentIds.length
        ? this.progress.listRecentEventsForUsers(studentIds, 15)
        : [],
      studentIds.length
        ? this.progress.listQuizResultsForUsers(studentIds, 10)
        : [],
    ]);
    const names = await this.nameMap([
      ...events.map((e) => e.userId),
      ...recentQuiz.map((r) => r.userId),
    ]);
    return {
      totalStudents: studentIds.length,
      activeStudents,
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        studentCount: c.studentUserIds.length,
        assignedCourseCount: c.assignedCourseIds.length,
      })),
      courses: {
        authored: authoredCourses,
        assignedToClasses: new Set(classes.flatMap((c) => c.assignedCourseIds))
          .size,
      },
      assignments: {
        total: assignmentCount,
        submissionsByStatus: statusCounts,
      },
      assessments: { attempts: avg.count, averageScorePercent: avg.average },
      recentQuizResults: recentQuiz.map((r) => ({
        ...r,
        learnerName: names.get(r.userId),
      })),
      recentActivities: events.map((e) => ({
        ...e,
        learnerName: names.get(e.userId),
      })),
    };
  }

  /** PRD section 23. */
  async school(actor: Actor, schoolId?: string) {
    const id =
      actor.role === UserRole.SUPER_ADMIN && schoolId
        ? schoolId
        : actor.schoolId;
    if (!id) throw new ForbiddenError('You are not attached to a school');
    const school = await this.schools.get(actor, id);
    const [roles, classes, studentIds] = await Promise.all([
      this.users.countByRole({ schoolId: id }),
      this.classes.listForSchool(id),
      this.users.findIds({ schoolId: id, role: UserRole.LEARNER }),
    ]);
    const since = new Date(Date.now() - 7 * DAY);
    const [active, avg, courseStats, certificates, schoolCourses, plan] =
      await Promise.all([
        studentIds.length
          ? this.progress.countActiveLearners({ since, userIds: studentIds })
          : 0,
        studentIds.length
          ? this.progress.averageQuizScore(studentIds)
          : { average: 0, count: 0 },
        studentIds.length
          ? this.progress.courseEnrollmentStats({
              userIds: studentIds,
              limit: 20,
            })
          : [],
        studentIds.length
          ? this.certificates.countIssued({ userIds: studentIds })
          : 0,
        this.catalog.countCourses({ schoolId: id }),
        this.subscriptions.hasActiveSchoolPlan(id),
      ]);
    const titles = await this.courseTitles(courseStats.map((c) => c.courseId));
    return {
      school: { id: school.id, name: school.name, settings: school.settings },
      hasActiveSchoolPlan: plan,
      totalStudents: roles[UserRole.LEARNER] ?? 0,
      teachers: roles[UserRole.TEACHER] ?? 0,
      classes: classes.length,
      courses: {
        schoolAuthored: schoolCourses,
        assignedToClasses: new Set(classes.flatMap((c) => c.assignedCourseIds))
          .size,
      },
      activeLearners7d: active,
      performance: {
        averageQuizScorePercent: avg.average,
        quizzesTaken: avg.count,
      },
      certificatesIssued: certificates,
      courseCompletion: courseStats.map((c) => ({
        ...c,
        title: titles.get(c.courseId),
        completionRate: c.enrolled
          ? Math.round((c.completed / c.enrolled) * 100)
          : 0,
      })),
    };
  }

  /** Super admin analytics (PRD sections 28 and 36). */
  async admin() {
    const now = Date.now();
    const [
      roles,
      active7,
      active30,
      courseCount,
      publishedCourses,
      byLanguage,
      languages,
      courseStats,
      events30,
      certificates,
      schools,
      parentsLinked,
      revenue,
      scans30,
    ] = await Promise.all([
      this.users.countByRole(),
      this.users.countActiveSince(new Date(now - 7 * DAY)),
      this.users.countActiveSince(new Date(now - 30 * DAY)),
      this.catalog.countCourses(),
      this.catalog.countCourses({ status: ContentStatus.PUBLISHED }),
      this.catalog.countCoursesByLanguage({ status: ContentStatus.PUBLISHED }),
      this.catalog.listLanguages(true),
      this.progress.courseEnrollmentStats({ limit: 10 }),
      this.progress.countEventsByType({ since: new Date(now - 30 * DAY) }),
      this.certificates.countIssued(),
      this.schools.count(),
      this.parents.countLinkedParents(),
      this.subscriptions.revenueSummary(new Date(now - 30 * DAY)),
      this.gamecard.countPlays({
        kind: 'scan',
        since: new Date(now - 30 * DAY),
      }),
    ]);
    const titles = await this.courseTitles(courseStats.map((c) => c.courseId));
    const totalEnrolled = courseStats.reduce((s, c) => s + c.enrolled, 0);
    const totalCompleted = courseStats.reduce((s, c) => s + c.completed, 0);
    return {
      users: {
        total: Object.values(roles).reduce((a, b) => a + b, 0),
        byRole: roles,
        active7d: active7,
        active30d: active30,
      },
      courses: { total: courseCount, published: publishedCourses, byLanguage },
      languages: languages.map((l) => ({
        code: l.code,
        name: l.name,
        isActive: l.isActive,
      })),
      popularCourses: courseStats.map((c) => ({
        ...c,
        title: titles.get(c.courseId),
        completionRate: c.enrolled
          ? Math.round((c.completed / c.enrolled) * 100)
          : 0,
      })),
      completionRate: totalEnrolled
        ? Math.round((totalCompleted / totalEnrolled) * 100)
        : 0,
      engagement30d: {
        lessonsCompleted: events30[LearningEventType.LESSON_COMPLETED] ?? 0,
        quizzesPassed: events30[LearningEventType.QUIZ_PASSED] ?? 0,
        gamesPlayed: events30[LearningEventType.GAME_PLAYED] ?? 0,
        gamecardScans: scans30,
      },
      certificatesIssued: certificates,
      schools,
      parentsLinked,
      revenue30d: revenue,
    };
  }

  private async recommendedCourses(
    preferredLanguage: string | undefined,
    enrolled: Array<{ courseId: string; languageCode: string; level?: string }>,
  ) {
    const excludeIds = enrolled.map((e) => e.courseId);
    const languages = new Set(
      [preferredLanguage, ...enrolled.map((e) => e.languageCode)].filter(
        Boolean,
      ) as string[],
    );
    const picks = [];
    for (const languageCode of languages) {
      const highest = enrolled
        .filter((e) => e.languageCode === languageCode && e.level)
        .map((e) => LEVEL_ORDER.indexOf(e.level as never))
        .reduce((max, i) => Math.max(max, i), -1);
      const level = LEVEL_ORDER[Math.min(highest + 1, LEVEL_ORDER.length - 1)];
      const page = await this.catalog.listPublishedCourses(
        { languageCode, level, excludeIds },
        { page: 1, limit: 2 },
      );
      picks.push(...page.items);
    }
    if (picks.length < 4) {
      const page = await this.catalog.listPublishedCourses(
        { excludeIds: [...excludeIds, ...picks.map((c) => c.id)] },
        { page: 1, limit: 4 - picks.length },
      );
      picks.push(...page.items);
    }
    return picks.slice(0, 4);
  }

  private async courseTitles(ids: string[]) {
    const courses = await this.catalog.findCourses(ids);
    return new Map(courses.map((c) => [c.id, c.title]));
  }

  private async nameMap(userIds: string[]) {
    const users = await this.users.findByIds([...new Set(userIds)]);
    return new Map(users.map((u) => [u.id, displayName(u)]));
  }
}
