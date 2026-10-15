import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ForbiddenError } from '../../../shared/domain/errors';
import { displayName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import { AssignmentsService } from '../../assignments';
import { CatalogQueryService } from '../../catalog';
import { ClassesService } from '../../classes';
import { UsersService } from '../../identity';
import { QuizAttemptsService } from '../../learning';
import { ProgressQueryService } from '../../progress';
import { canAdministerSchool, SchoolsService } from '../../schools';
import { LearnerAccessService } from './learner-access.service';
import { LearnerInsightsService } from './learner-insights.service';

const DAY = 86_400_000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly access: LearnerAccessService,
    private readonly insights: LearnerInsightsService,
    private readonly progress: ProgressQueryService,
    private readonly catalog: CatalogQueryService,
    private readonly classes: ClassesService,
    private readonly assignments: AssignmentsService,
    private readonly quizzes: QuizAttemptsService,
    private readonly users: UsersService,
    private readonly schools: SchoolsService,
  ) {}

  /** Learner report: completion, quiz/game performance, activities, time. */
  async learner(actor: Actor, learnerId: string) {
    const learner = await this.access.assertCanView(actor, learnerId);
    const summary = await this.insights.summary(learner);
    const [courseProgress, attempts, gamesPlayed] = await Promise.all([
      Promise.all(
        summary.courses.map((c) =>
          this.progress.getCourseProgress(learnerId, c.courseId),
        ),
      ),
      this.quizzes.listForLearners([learnerId], {}),
      this.progress.gamesPlayedBy(learnerId),
    ]);
    return {
      ...summary,
      courseProgress: courseProgress.map((p) => ({
        courseId: p.courseId,
        title: summary.courses.find((c) => c.courseId === p.courseId)?.title,
        percent: p.percent,
        lessons: p.lessons,
        quizzes: p.quizzes,
        activitiesCompleted: p.activitiesCompleted,
        complete: p.complete,
      })),
      quizPerformance: {
        attempts: attempts.length,
        passed: attempts.filter((a) => a.passed).length,
        averageScorePercent: attempts.length
          ? Math.round(
              attempts.reduce((s, a) => s + a.scorePercent, 0) /
                attempts.length,
            )
          : 0,
        recentAttempts: attempts.slice(0, 20),
      },
      gamePerformance: {
        gamesPlayed: summary.counters.gamesPlayed,
        gamecardScans: summary.counters.gamecardScans,
        totalGameEvents: gamesPlayed,
      },
    };
  }

  /** Teacher report: class and individual learner performance. */
  async classReport(actor: Actor, classId: string) {
    const classroom = await this.classes.requireManaged(actor, classId);
    const studentIds = classroom.studentUserIds;
    const [students, stats, courseRows, avg, statusCounts] = await Promise.all([
      this.users.findByIds(studentIds),
      this.progress.getStatsForUsers(studentIds),
      Promise.all(
        classroom.assignedCourseIds.flatMap((courseId) =>
          studentIds.map((id) =>
            this.progress
              .getCourseProgress(id, courseId)
              .then((p) => ({ ...p, userId: id })),
          ),
        ),
      ),
      studentIds.length
        ? this.progress.averageQuizScore(studentIds)
        : { average: 0, count: 0 },
      studentIds.length
        ? this.assignments.countSubmissionsByStatus({ learnerIds: studentIds })
        : {},
    ]);
    const courses = await this.catalog.findCourses(classroom.assignedCourseIds);
    const statsByUser = new Map(stats.map((s) => [s.userId, s]));
    const quizzes = await this.progress.listQuizResultsForUsers(
      studentIds,
      1000,
    );

    const learners = students.map((s) => {
      const st = statsByUser.get(s.id);
      const results = quizzes.filter((q) => q.userId === s.id);
      return {
        learnerId: s.id,
        name: displayName(s),
        points: st?.totalPoints ?? 0,
        streakDays: st?.streakDays ?? 0,
        learningMinutes: st?.learningMinutes ?? 0,
        lessonsCompleted: st?.counters.lessonsCompleted ?? 0,
        averageQuizScorePercent: results.length
          ? Math.round(
              results.reduce((sum, r) => sum + r.bestScorePercent, 0) /
                results.length,
            )
          : null,
        courses: courseRows
          .filter((r) => r.userId === s.id)
          .map((r) => ({
            courseId: r.courseId,
            percent: r.percent,
            complete: r.complete,
          })),
      };
    });

    return {
      class: {
        id: classroom.id,
        name: classroom.name,
        studentCount: studentIds.length,
      },
      courses: courses.map((c) => {
        const rows = courseRows.filter((r) => r.courseId === c.id);
        return {
          courseId: c.id,
          title: c.title,
          averagePercent: rows.length
            ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length)
            : 0,
          completed: rows.filter((r) => r.complete).length,
        };
      }),
      quizPerformance: avg,
      assignments: statusCounts,
      learners,
    };
  }

  /** School report: engagement, completion, performance, teacher activity. */
  async schoolReport(actor: Actor, schoolId: string) {
    if (!canAdministerSchool(actor, schoolId))
      throw new ForbiddenError('You can only report on your own school');
    const school = await this.schools.get(actor, schoolId);
    const [studentIds, teachers, classes] = await Promise.all([
      this.users.findIds({ schoolId, role: UserRole.LEARNER }),
      this.users.list(
        { schoolId, role: UserRole.TEACHER },
        { page: 1, limit: 100 },
      ),
      this.classes.listForSchool(schoolId),
    ]);
    const now = Date.now();
    const [active7, active30, avg, courseStats] = await Promise.all([
      studentIds.length
        ? this.progress.countActiveLearners({
            since: new Date(now - 7 * DAY),
            userIds: studentIds,
          })
        : 0,
      studentIds.length
        ? this.progress.countActiveLearners({
            since: new Date(now - 30 * DAY),
            userIds: studentIds,
          })
        : 0,
      studentIds.length
        ? this.progress.averageQuizScore(studentIds)
        : { average: 0, count: 0 },
      studentIds.length
        ? this.progress.courseEnrollmentStats({
            userIds: studentIds,
            limit: 50,
          })
        : [],
    ]);
    const titles = new Map(
      (await this.catalog.findCourses(courseStats.map((c) => c.courseId))).map(
        (c) => [c.id, c.title],
      ),
    );
    const teacherActivity = await Promise.all(
      teachers.items.map(async (t) => {
        const own = classes.filter((c) => c.teacherUserId === t.id);
        return {
          teacherId: t.id,
          name: displayName(t),
          classes: own.length,
          students: new Set(own.flatMap((c) => c.studentUserIds)).size,
          assignmentsCreated: await this.assignments.countAssignments({
            classroomIds: own.map((c) => c.id),
          }),
          lastActiveAt: t.lastActiveAt,
        };
      }),
    );
    return {
      school: { id: school.id, name: school.name },
      studentEngagement: {
        students: studentIds.length,
        active7d: active7,
        active30d: active30,
        engagementRate7d: studentIds.length
          ? Math.round((active7 / studentIds.length) * 100)
          : 0,
      },
      courseCompletion: courseStats.map((c) => ({
        ...c,
        title: titles.get(c.courseId),
        completionRate: c.enrolled
          ? Math.round((c.completed / c.enrolled) * 100)
          : 0,
      })),
      averagePerformance: avg,
      teacherActivity,
    };
  }
}
