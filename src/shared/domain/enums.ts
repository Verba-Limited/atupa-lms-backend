export enum ContentStatus {
  DRAFT = 'draft',
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
