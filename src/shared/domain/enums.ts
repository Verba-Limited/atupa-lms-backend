export enum ContentStatus {
  DRAFT = 'draft',
  /** Waiting for a super admin to approve it. */
  IN_REVIEW = 'in_review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ProficiencyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export const LEVEL_ORDER: ProficiencyLevel[] = [
  ProficiencyLevel.BEGINNER,
  ProficiencyLevel.INTERMEDIATE,
  ProficiencyLevel.ADVANCED,
];
