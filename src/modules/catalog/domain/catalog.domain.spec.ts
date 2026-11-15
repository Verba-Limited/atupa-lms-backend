import { Actor } from '../../../shared/application/actor';
import { ContentStatus, ProficiencyLevel } from '../../../shared/domain/enums';
import { UserRole } from '../../../shared/domain/user-role';
import { canManageCourse } from './content-access.policy';
import {
  AgeGroup,
  Course,
  CourseOwnerType,
  CourseType,
  CourseVisibility,
} from './course.entity';
import { isDiscoverable, requiresReview } from './review.policy';
import {
  assertValidQuestions,
  QuestionType,
  toLearnerQuestion,
} from './quiz.entity';

const course = (overrides: Partial<Course> = {}): Course => ({
  id: 'c1',
  languageCode: 'yoruba',
  level: ProficiencyLevel.BEGINNER,
  title: 'Yoruba',
  courseType: CourseType.LANGUAGE,
  ageGroup: AgeGroup.ALL,
  isPremium: false,
  tags: [],
  status: ContentStatus.DRAFT,
  createdByUserId: 't1',
  schoolId: 's1',
  visibility: CourseVisibility.PRIVATE,
  ownerType: CourseOwnerType.TEACHER,
  ...overrides,
});

describe('content review policy', () => {
  const actor = (role: UserRole): Actor => ({
    userId: 'u1',
    email: 'u@x.test',
    role,
  });

  it('lets teachers publish their own Private and School courses', () => {
    expect(requiresReview(actor(UserRole.TEACHER), course())).toBe(false);
    expect(
      requiresReview(
        actor(UserRole.TEACHER),
        course({ visibility: CourseVisibility.SCHOOL }),
      ),
    ).toBe(false);
  });

  it('sends Public teacher courses and all ATUPA content to review', () => {
    expect(
      requiresReview(
        actor(UserRole.TEACHER),
        course({ visibility: CourseVisibility.PUBLIC }),
      ),
    ).toBe(true);
    const atupa = course({
      ownerType: CourseOwnerType.ATUPA,
      visibility: CourseVisibility.PUBLIC,
    });
    expect(requiresReview(actor(UserRole.CONTENT_CREATOR), atupa)).toBe(true);
    expect(requiresReview(actor(UserRole.SUPPORT_ADMIN), atupa)).toBe(true);
    expect(requiresReview(actor(UserRole.SUPER_ADMIN), atupa)).toBe(false);
  });

  it('lists only published Public courses', () => {
    expect(
      isDiscoverable(
        course({
          status: ContentStatus.PUBLISHED,
          visibility: CourseVisibility.PUBLIC,
        }),
      ),
    ).toBe(true);
    expect(isDiscoverable(course({ status: ContentStatus.PUBLISHED }))).toBe(
      false,
    );
    expect(
      isDiscoverable(
        course({
          status: ContentStatus.IN_REVIEW,
          visibility: CourseVisibility.PUBLIC,
        }),
      ),
    ).toBe(false);
  });
});
const actor = (role: UserRole, userId = 'x', schoolId?: string): Actor => ({
  role,
  userId,
  email: 'e',
  schoolId,
});

describe('course ownership policy', () => {
  it.each([
    [actor(UserRole.SUPER_ADMIN), true],
    [actor(UserRole.CONTENT_CREATOR), true],
    [actor(UserRole.TEACHER, 't1'), true],
    [actor(UserRole.TEACHER, 't2', 's1'), false],
    [actor(UserRole.SCHOOL_ADMIN, 'a', 's1'), true],
    [actor(UserRole.SCHOOL_ADMIN, 'a', 's2'), false],
    [actor(UserRole.LEARNER, 't1'), false],
  ])('%o -> %s', (a, expected) => {
    expect(canManageCourse(a, course())).toBe(expected);
  });
});

describe('quiz questions', () => {
  it('requires the answer to be one of the choices', () => {
    expect(() =>
      assertValidQuestions([
        {
          id: '1',
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: 'p',
          options: { choices: ['a', 'b'] },
          correctAnswer: 'c',
          points: 1,
        },
      ]),
    ).toThrow('one of the choices');
  });

  it('requires media for audio questions and true/false keys', () => {
    expect(() =>
      assertValidQuestions([
        {
          id: '1',
          type: QuestionType.AUDIO,
          prompt: 'p',
          options: { choices: ['a', 'b'] },
          correctAnswer: 'a',
          points: 1,
        },
      ]),
    ).toThrow('mediaUrl');
    expect(() =>
      assertValidQuestions([
        {
          id: '1',
          type: QuestionType.TRUE_FALSE,
          prompt: 'p',
          correctAnswer: 'yes',
          points: 1,
        },
      ]),
    ).toThrow();
  });

  it('strips answers from the learner view', () => {
    const view = toLearnerQuestion({
      id: '1',
      type: QuestionType.FILL_BLANK,
      prompt: 'p',
      correctAnswer: 'a',
      acceptedAnswers: ['b'],
      explanation: 'because',
      points: 1,
    });
    expect(view).not.toHaveProperty('correctAnswer');
    expect(view).not.toHaveProperty('acceptedAnswers');
    expect(view).not.toHaveProperty('explanation');
  });
});
