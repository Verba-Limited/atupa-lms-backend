import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../../../shared/domain/user-role';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import {
  PaginationQueryDto,
  pageOf,
} from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { AuditService } from '../../application/audit.service';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  actorId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @ApiPropertyOptional({
    example: 'publish',
    description: 'Part of the action',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ description: 'Id of the record that was changed' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@ApiTags('Admin · Activity log')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/activity-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Who did what and when, newest first. */
  @Get()
  async list(@Query() query: AuditQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.audit.list(filter, pageOf({ page, limit })));
  }
}
