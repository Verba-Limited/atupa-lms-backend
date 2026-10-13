import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(UserRole.LEARNER, UserRole.PARENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Get('learners/:userId')
  learner(@Param('userId') userId: string) {
    return this.reportsService.learnerReport(userId).then((data) => ok(data));
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @Get('admin/analytics')
  admin(@CurrentUser() _user: AuthenticatedUser) {
    return this.reportsService.adminAnalytics().then((data) => ok(data));
  }
}
