export enum UserRole {
  LEARNER = 'learner',
  PARENT = 'parent',
  TEACHER = 'teacher',
  SCHOOL_ADMIN = 'school_admin',
  CONTENT_CREATOR = 'content_creator',
  /** ATUPA/Verba staff who manage course content, classes and learners. */
  SUPPORT_ADMIN = 'support_admin',
  SUPER_ADMIN = 'super_admin',
}

export const ALL_ROLES = Object.values(UserRole);

/** Roles anyone can pick on the public sign-up form. */
export const SELF_REGISTRATION_ROLES = [
  UserRole.LEARNER,
  UserRole.PARENT,
  UserRole.TEACHER,
] as const;

/** Roles allowed to author learning content. */
export const CONTENT_AUTHOR_ROLES = [
  UserRole.TEACHER,
  UserRole.CONTENT_CREATOR,
  UserRole.SUPPORT_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.SUPER_ADMIN,
];

/** Roles that manage platform-wide content regardless of ownership. */
export const PLATFORM_CONTENT_ROLES = [
  UserRole.CONTENT_CREATOR,
  UserRole.SUPPORT_ADMIN,
  UserRole.SUPER_ADMIN,
];

/** ATUPA staff who use the admin console. */
export const STAFF_ROLES = [
  UserRole.CONTENT_CREATOR,
  UserRole.SUPPORT_ADMIN,
  UserRole.SUPER_ADMIN,
];

/** Staff who look after users, classes and learner support. */
export const SUPPORT_ROLES = [UserRole.SUPPORT_ADMIN, UserRole.SUPER_ADMIN];
