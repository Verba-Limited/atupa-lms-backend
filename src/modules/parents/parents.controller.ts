import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { ProgressService } from '../progress/progress.service';
import { UsersService } from '../users/users.service';

@ApiTags('Parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parents')
export class ParentsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly progressService: ProgressService,
  ) {}

  @Post('link-child')
  async linkChild(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { childUserId: string; verificationCode?: string },
  ) {
    if (!body.verificationCode) {
      return ok(null, 'Child linking requires verification code');
    }
    const child = await this.usersService.getByIdOrThrow(body.childUserId);
    if (child.role !== UserRole.LEARNER) {
      return ok(null, 'Only learner accounts can be linked');
    }
    const parent = await this.usersService.linkChild(user.userId, body.childUserId);
    return ok({ linkedChildIds: parent.linkedChildIds });
  }

  @Get('children/progress')
  async childProgress(@CurrentUser() user: AuthenticatedUser) {
    const parent = await this.usersService.getByIdOrThrow(user.userId);
    const summaries = await this.progressService.getChildSummaries(
      parent.linkedChildIds,
    );
    return ok(summaries);
  }
}
