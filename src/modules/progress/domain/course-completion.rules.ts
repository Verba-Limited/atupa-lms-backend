export interface CourseRequirementsLike {
  lessonIds: string[];
  quizIds: string[];
}

export interface CourseProgressSummary {
  percent: number;
  lessons: { completed: number; total: number };
  quizzes: { passed: number; total: number };
  complete: boolean;
}

/**
 * A course is complete when every published lesson is completed and every
 * quiz in it is passed (the PRD "completion rules").
 */
export function summarizeCourseProgress(
  requirements: CourseRequirementsLike,
  completedLessonIds: Set<string>,
  passedQuizIds: Set<string>,
): CourseProgressSummary {
  const lessonsDone = requirements.lessonIds.filter((id) =>
    completedLessonIds.has(id),
  ).length;
  const quizzesDone = requirements.quizIds.filter((id) =>
    passedQuizIds.has(id),
  ).length;
  const total = requirements.lessonIds.length + requirements.quizIds.length;
  const done = lessonsDone + quizzesDone;
  return {
    percent: total ? Math.round((done / total) * 100) : 0,
    lessons: { completed: lessonsDone, total: requirements.lessonIds.length },
    quizzes: { passed: quizzesDone, total: requirements.quizIds.length },
    complete: total > 0 && done === total,
  };
}
