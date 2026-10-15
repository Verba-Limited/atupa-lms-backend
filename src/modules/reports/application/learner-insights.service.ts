import { Injectable } from '@nestjs/common';
import { AssignmentStatus, AssignmentsService } from '../../assignments';
import { CatalogQueryService } from '../../catalog';
import { CertificatesService } from '../../certificates';
import { PublicUser } from '../../identity';
import { BADGES, ProgressQueryService } from '../../progress';

/** Builds the per-learner summaries shared by dashboards and reports. */
@Injectable()
export class LearnerInsightsService {
  constructor(
    private readonly progress: ProgressQueryService,
    private readonly catalog: CatalogQueryService,
    private readonly certificates: CertificatesService,
    private readonly assignments: AssignmentsService,
  ) {}

  async summary(learner: PublicUser) {
    const [stats, enrollments, quizResults, certificates, recent, continueAt] =
      await Promise.all([
        this.progress.getStats(learner.id),
        this.progress.listEnrollments(learner.id),
        this.progress.listQuizResults(learner.id, 10),
        this.certificates.listForUsers([learner.id]),
        this.progress.listRecentEvents(learner.id, 10),
        this.progress.getContinueLearning(learner.id),
      ]);
    const courses = await this.catalog.findCourses(
      enrollments.map((e) => e.courseId),
    );
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const [continueLesson] = continueAt
      ? await this.catalog.findLessons([continueAt.lessonId])
      : [];

    return {
      learner: {
        id: learner.id,
        firstName: learner.firstName,
        lastName: learner.lastName,
        preferredLanguageCode: learner.preferredLanguageCode,
      },
      points: stats.totalPoints,
      streakDays: stats.streakDays,
      longestStreakDays: stats.longestStreakDays,
      learningMinutes: stats.learningMinutes,
      counters: stats.counters,
      badges: stats.badges.map((b) => ({
        ...b,
        name: BADGES.find((d) => d.code === b.code)?.name ?? b.code,
      })),
      courses: enrollments
        .filter((e) => courseById.has(e.courseId))
        .map((e) => ({
          courseId: e.courseId,
          title: courseById.get(e.courseId)?.title,
          languageCode: e.languageCode,
          level: courseById.get(e.courseId)?.level,
          status: e.status,
          progressPercent: e.progressPercent,
          lastAccessedAt: e.lastAccessedAt,
        })),
      continueLearning:
        continueAt && continueLesson
          ? {
              courseId: continueAt.courseId,
              courseTitle: courseById.get(continueAt.courseId)?.title,
              lessonId: continueAt.lessonId,
              lessonTitle: continueLesson.title,
              lessonProgressPercent: continueAt.progressPercent,
              lastBlockIndex: continueAt.lastBlockIndex,
              courseProgressPercent:
                enrollments.find((e) => e.courseId === continueAt.courseId)
                  ?.progressPercent ?? 0,
            }
          : null,
      quizScores: quizResults.map((r) => ({
        quizId: r.quizId,
        quizTitle: r.quizTitle,
        bestScorePercent: r.bestScorePercent,
        lastScorePercent: r.lastScorePercent,
        passed: r.passed,
        attempts: r.attempts,
      })),
      certificates: certificates.map((c) => ({
        id: c.id,
        certificateId: c.certificateId,
        courseTitle: c.courseTitle,
        completedAt: c.completedAt,
        status: c.status,
      })),
      recentActivities: recent,
    };
  }

  /** Teacher feedback on the learner's assignments (for parents). */
  async teacherFeedback(learnerId: string) {
    const submissions = (
      await this.assignments.listSubmissionsForLearners([learnerId], 50)
    ).filter(
      (s) =>
        (s.status === AssignmentStatus.REVIEWED ||
          s.status === AssignmentStatus.COMPLETED) &&
        (s.feedback || s.score !== undefined),
    );
    const assignments = await this.assignments.findAssignments(
      submissions.map((s) => s.assignmentId),
    );
    const byId = new Map(assignments.map((a) => [a.id, a]));
    return submissions.map((s) => ({
      assignmentId: s.assignmentId,
      title: byId.get(s.assignmentId)?.title,
      score: s.score,
      maxScore: byId.get(s.assignmentId)?.maxScore,
      feedback: s.feedback,
      reviewedAt: s.reviewedAt,
    }));
  }
}
