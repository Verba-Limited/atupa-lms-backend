export enum UserRole {
  LEARNER = 'learner',
  PARENT = 'parent',
  TEACHER = 'teacher',
  SCHOOL_ADMIN = 'school_admin',
  CONTENT_CREATOR = 'content_creator',
  SUPER_ADMIN = 'super_admin',
}

export const ALL_ROLES = Object.values(UserRole);
