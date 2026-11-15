import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { ForbiddenError } from '../../../../shared/domain/errors';
import {
  STAFF_ROLES,
  SUPPORT_ROLES,
  UserRole,
} from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { UsersService } from '../../application/users.service';
import {
  AdminUpdateUserDto,
  InviteUserDto,
  ListUsersQueryDto,
  VerificationDecisionDto,
} from './dto/admin-users.dto';

/** Support admins may only create learner, parent and teacher accounts. */
const SUPPORT_CREATABLE_ROLES = [
  UserRole.LEARNER,
  UserRole.PARENT,
  UserRole.TEACHER,
];

/**
 * Super admins manage every account. Support admins look users up, help
 * them back into their accounts and create non-staff accounts.
 */
@ApiTags('Admin · Users')
@ApiBearerAuth()
@Roles(...SUPPORT_ROLES)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    const { role, schoolId, isActive, verificationStatus, q } = query;
    return ok(
      await this.users.list(
        { role, schoolId, isActive, verificationStatus, q },
        pageOf(query),
      ),
    );
  }

  @Get(':userId')
  async get(@IdParam('userId') userId: string) {
    return ok(await this.users.getById(userId));
  }

  @Post()
  async invite(@CurrentUser() actor: Actor, @Body() dto: InviteUserDto) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      !SUPPORT_CREATABLE_ROLES.includes(dto.role)
    ) {
      throw new ForbiddenError('Only a super admin can create staff accounts');
    }
    return ok(
      await this.users.invite({ ...dto, invitedByName: 'ATUPA Admin' }),
      'User invited. They will receive an email to set their password.',
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':userId')
  async update(
    @CurrentUser() actor: Actor,
    @IdParam('userId') userId: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return ok(
      await this.users.adminUpdate(userId, dto, actor.userId),
      'User updated',
    );
  }

  /** Resends the invite (never logged in) or emails a password reset link. */
  @HttpCode(200)
  @Post(':userId/access-link')
  async sendAccessLink(
    @CurrentUser() actor: Actor,
    @IdParam('userId') userId: string,
  ) {
    const target = await this.users.getById(userId);
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      STAFF_ROLES.includes(target.role)
    ) {
      throw new ForbiddenError('Only a super admin can help staff accounts');
    }
    const result = await this.users.sendAccessLink(userId);
    return ok(
      result,
      result.sent === 'invite'
        ? 'Invitation sent again'
        : 'Password reset link sent',
    );
  }

  /** Approve or reject a teacher's verification documents (M-08 / M-28). */
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post(':userId/verification')
  async decideVerification(
    @CurrentUser() actor: Actor,
    @IdParam('userId') userId: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    const approve = dto.decision === 'approve';
    return ok(
      await this.users.decideVerification(
        userId,
        approve,
        actor.userId,
        dto.reason,
      ),
      approve ? 'Teacher verified' : 'Teacher rejected',
    );
  }

  /** Deletes (anonymises) a user's account. */
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':userId')
  async remove(@CurrentUser() actor: Actor, @IdParam('userId') userId: string) {
    await this.users.adminDelete(userId, actor.userId);
    return ok(null, 'User deleted');
  }
}
