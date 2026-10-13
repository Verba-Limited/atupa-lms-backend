import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ok } from '../../common/utils/api-response';
import { SchoolsService } from './schools.service';

@ApiTags('Schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @Post()
  create(@Body() body: { name: string; region?: string }) {
    return this.schoolsService.create(body.name, body.region).then((data) => ok(data));
  }

  @Get()
  list() {
    return this.schoolsService.list().then((data) => ok(data));
  }
}
