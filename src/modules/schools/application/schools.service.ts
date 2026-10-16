import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { SchoolMemberRemoved } from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { PageRequest } from '../../../shared/domain/pagination';
import { randomCode } from '../../../shared/domain/random-code';
import { displayName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import {
  AuthService,
  AuthSession,
  PublicUser,
  UsersService,
} from '../../identity';
import {
  assertCanAdministerSchool,
  DEFAULT_SCHOOL_SETTINGS,
  School,
  SchoolSettings,
} from '../domain/school.entity';
import type { SchoolRepository } from './ports/school.repository.port';
import { SCHOOL_REPOSITORY } from './ports/school.repository.port';

export interface SchoolProfileInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  region?: string;
  declaredStudentCount?: number;
}

export interface RegisterSchoolInput extends SchoolProfileInput {
  admin: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
}

export interface AddMemberInput {
  role: UserRole;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  languageSpecializations?: string[];
}

const MEMBER_ROLES_FOR_SCHOOL_ADMIN = [UserRole.TEACHER, UserRole.LEARNER];

@Injectable()
export class SchoolsService {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly schools: SchoolRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  /** Public "Register School": creates the school and its admin account. */
  async register(
    input: RegisterSchoolInput,
  ): Promise<{ school: School; session: AuthSession }> {
    if (await this.users.findByEmail(input.admin.email)) {
      throw new ConflictError('The admin email is already registered');
    }
    if (await this.schools.findByName(input.name)) {
      throw new ConflictError('A school with this name already exists');
    }
    const { admin, ...profile } = input;
    const school = await this.createSchool(profile);
    try {
      const session = await this.auth.createAccount({
        ...admin,
        role: UserRole.SCHOOL_ADMIN,
        schoolId: school.id,
      });
      const updated = (await this.schools.update(school.id, {
        adminUserId: session.user.id,
      })) as School;
      return { school: updated, session };
    } catch (error) {
      await this.schools.delete(school.id);
      throw error;
    }
  }

  /** Super admin creates a school (and can invite its admin afterwards). */
  createByAdmin(input: SchoolProfileInput): Promise<School> {
    return this.createSchool(input);
  }

  async get(actor: Actor, schoolId: string): Promise<School> {
    const school = await this.require(schoolId);
    if (actor.role !== UserRole.SUPER_ADMIN && actor.schoolId !== schoolId) {
      throw new ForbiddenError('You are not a member of this school');
    }
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.role !== UserRole.SCHOOL_ADMIN
    ) {
      return { ...school, joinCode: '' };
    }
    return school;
  }

  list(filter: { q?: string; isActive?: boolean }, page: PageRequest) {
    return this.schools.list(filter, page);
  }

  async update(
    actor: Actor,
    schoolId: string,
    patch: Partial<SchoolProfileInput> & {
      settings?: Partial<SchoolSettings>;
      isActive?: boolean;
    },
  ): Promise<School> {
    assertCanAdministerSchool(actor, schoolId);
    const school = await this.require(schoolId);
    if (patch.isActive !== undefined && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError(
        'Only a super admin can activate or deactivate schools',
      );
    }
    return (await this.schools.update(schoolId, {
      ...patch,
      settings: { ...school.settings, ...(patch.settings ?? {}) },
    })) as School;
  }

  /** Super admin only. Schools with members must be deactivated instead. */
  async remove(actor: Actor, schoolId: string): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super admin can delete schools');
    }
    await this.require(schoolId);
    const members = await this.users.countByRole({ schoolId });
    const total = Object.values(members).reduce((a, b) => a + b, 0);
    if (total > 0) {
      throw new ConflictError(
        `This school still has ${total} member(s). Remove them first or deactivate the school (isActive=false).`,
      );
    }
    await this.schools.delete(schoolId);
  }

  async rotateJoinCode(actor: Actor, schoolId: string): Promise<School> {
    assertCanAdministerSchool(actor, schoolId);
    await this.require(schoolId);
    return (await this.schools.update(schoolId, {
      joinCode: randomCode(8),
    })) as School;
  }

  /** Invites a new teacher/learner account into the school. */
  async addMember(
    actor: Actor,
    schoolId: string,
    input: AddMemberInput,
  ): Promise<PublicUser> {
    assertCanAdministerSchool(actor, schoolId);
    const allowed =
      actor.role === UserRole.SUPER_ADMIN
        ? [...MEMBER_ROLES_FOR_SCHOOL_ADMIN, UserRole.SCHOOL_ADMIN]
        : MEMBER_ROLES_FOR_SCHOOL_ADMIN;
    if (!allowed.includes(input.role)) {
      throw new ForbiddenError(`You cannot add ${input.role} accounts`);
    }
    const school = await this.require(schoolId);
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(
        `${input.email} already has an account. Ask them to join with the school code instead.`,
      );
    }
    const inviter = await this.users.findById(actor.userId);
    return this.users.invite({
      ...input,
      schoolId,
      invitedByName: inviter
        ? `${displayName(inviter)} (${school.name})`
        : school.name,
    });
  }

  async listMembers(
    actor: Actor,
    schoolId: string,
    role: UserRole | undefined,
    page: PageRequest,
  ) {
    assertCanAdministerSchool(actor, schoolId);
    return this.users.list({ schoolId, role }, page);
  }

  async removeMember(
    actor: Actor,
    schoolId: string,
    userId: string,
  ): Promise<void> {
    assertCanAdministerSchool(actor, schoolId);
    if (userId === actor.userId)
      throw new ValidationError('You cannot remove yourself');
    const member = await this.users.getById(userId);
    if (member.schoolId !== schoolId)
      throw new NotFoundError('User is not in this school');
    await this.users.setSchool(userId, null);
    await this.events.publish(new SchoolMemberRemoved(schoolId, userId));
  }

  /** Existing learners/teachers join a school with its join code. */
  async join(actor: Actor, joinCode: string): Promise<School> {
    if (actor.role !== UserRole.LEARNER && actor.role !== UserRole.TEACHER) {
      throw new ForbiddenError('Only learners and teachers can join a school');
    }
    if (actor.schoolId)
      throw new ConflictError('You already belong to a school');
    const school = await this.schools.findByJoinCode(
      joinCode.trim().toUpperCase(),
    );
    if (!school || !school.isActive)
      throw new NotFoundError('Invalid school code');
    await this.users.setSchool(actor.userId, school.id);
    return { ...school, joinCode: '' };
  }

  // ---- Facade -------------------------------------------------------------

  findById(schoolId: string): Promise<School | null> {
    return this.schools.findById(schoolId);
  }

  findByIds(ids: string[]): Promise<School[]> {
    return this.schools.findByIds(ids);
  }

  async getSettings(schoolId: string): Promise<SchoolSettings> {
    return (
      (await this.schools.findById(schoolId))?.settings ??
      DEFAULT_SCHOOL_SETTINGS
    );
  }

  count(): Promise<number> {
    return this.schools.count();
  }

  private createSchool(input: SchoolProfileInput): Promise<School> {
    return this.schools.create({
      ...input,
      joinCode: randomCode(8),
      settings: { ...DEFAULT_SCHOOL_SETTINGS },
      isActive: true,
    });
  }

  private async require(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId);
    if (!school) throw new NotFoundError('School not found');
    return school;
  }
}
