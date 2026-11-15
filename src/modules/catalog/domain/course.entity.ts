import { ContentStatus, ProficiencyLevel } from '../../../shared/domain/enums';

export enum CourseType {
  LANGUAGE = 'language',
  CULTURE = 'culture',
  GAME = 'game',
  MIXED = 'mixed',
}

export enum AgeGroup {
  ALL = 'all',
  CHILDREN = 'children',
  TEENS = 'teens',
  ADULTS = 'adults',
}

/** Who can find and take a course (M-25). */
export enum CourseVisibility {
  /** Only learners in classes it is assigned to (default for teachers). */
  PRIVATE = 'private',
  /** Every learner in the teacher's school. */
  SCHOOL = 'school',
  /** Any learner, through browse and search. */
  PUBLIC = 'public',
}

/** "By ATUPA" courses come from ATUPA staff; others from teachers/schools. */
export enum CourseOwnerType {
  ATUPA = 'atupa',
  TEACHER = 'teacher',
  SCHOOL = 'school',
}

/** Outcome of a super admin review of content or a visibility request. */
export interface ReviewRecord {
  submittedAt?: Date | null;
  submittedByUserId?: string | null;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
  decision?: 'approved' | 'rejected' | null;
  comment?: string | null;
}

/** A teacher's request to make a course Public, waiting for review. */
export interface PublicRequest {
  status: 'pending' | 'rejected';
  requestedAt: Date;
  requestedByUserId: string;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
  comment?: string | null;
}

export interface Course {
  id: string;
  languageCode: string;
  level: ProficiencyLevel;
  title: string;
  description?: string;
  courseType: CourseType;
  ageGroup: AgeGroup;
  durationMinutes?: number;
  isPremium: boolean;
  coverImageUrl?: string;
  tags: string[];
  status: ContentStatus;
  createdByUserId?: string;
  /** Set for courses authored inside a school (teacher / school admin). */
  schoolId?: string | null;
  visibility: CourseVisibility;
  ownerType: CourseOwnerType;
  publicRequest?: PublicRequest | null;
  review?: ReviewRecord | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
}
