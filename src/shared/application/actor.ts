import { UserRole } from '../domain/user-role';

/** The authenticated user performing a use case. */
export interface Actor {
  userId: string;
  email: string;
  role: UserRole;
  schoolId?: string;
}

export function isRole(actor: Actor, ...roles: UserRole[]): boolean {
  return roles.includes(actor.role);
}
