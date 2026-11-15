import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../../../shared/domain/user-role';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true;

export class VerificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['teacher', 'school'], default: 'teacher' })
  @IsOptional()
  @IsIn(['teacher', 'school'])
  type: 'teacher' | 'school' = 'teacher';

  @ApiPropertyOptional({
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'pending',
  })
  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  status: string = 'pending';
}

export class BulkLearnersDto {
  @ApiPropertyOptional({
    description: 'true = only check the file (default); false = save',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => !(value === 'false' || value === false))
  @IsBoolean()
  dryRun: boolean = true;

  @ApiPropertyOptional({ description: 'Add the new learners to this class' })
  @IsOptional()
  @IsMongoId()
  classId?: string;

  @ApiPropertyOptional({
    description: 'CSV text instead of a file (e.g. rows pasted into a box)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024 * 1024)
  csv?: string;
}

export class ReportFormatDto {
  @ApiPropertyOptional({ enum: ['csv', 'pdf'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf' = 'csv';
}

export class UsersExportQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class DateRangeQueryDto {
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

export class PaymentsExportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'success', 'failed'] })
  @IsOptional()
  @IsIn(['pending', 'success', 'failed'])
  status?: 'pending' | 'success' | 'failed';
}

export class ActivityExportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  actorId?: string;
}
