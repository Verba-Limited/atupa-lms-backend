import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
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
} from './dto/admin-users.dto';

@ApiTags('Admin · Users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    const { role, schoolId, isActive, q } = query;
    return ok(
      await this.users.list({ role, schoolId, isActive, q }, pageOf(query)),
    );
  }

  @Get(':userId')
  async get(@IdParam('userId') userId: string) {
    return ok(await this.users.getById(userId));
  }

  @Post()
  async invite(@CurrentUser() actor: Actor, @Body() dto: InviteUserDto) {
    return ok(
      await this.users.invite({ ...dto, invitedByName: 'ATUPA Admin' }),
      'User invited. They will receive an email to set their password.',
    );
  }

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
}
