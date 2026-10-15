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
