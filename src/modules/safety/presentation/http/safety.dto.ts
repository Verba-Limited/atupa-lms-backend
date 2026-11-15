import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { AlertType } from '../../domain/alert.entity';
import {
  ReportOutcome,
  ReportReason,
  type ReportTargetType,
} from '../../domain/safety-report.entity';

const TARGETS = ['teacher', 'school', 'course', 'class'];

export class FileReportDto {
  @ApiProperty({ enum: TARGETS })
  @IsIn(TARGETS)
  targetType!: ReportTargetType;

  @ApiProperty({ description: 'Id of the teacher, school, course or class' })
  @IsMongoId()
  targetId!: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiPropertyOptional({
    example: 'The teacher asked me for my mum’s phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Screenshot ids from uploads with purpose=report',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsMongoId({ each: true })
  attachmentIds?: string[];
}

export class ReportQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'in_review', 'resolved'] })
  @IsOptional()
  @IsIn(['open', 'in_review', 'resolved'])
  status?: 'open' | 'in_review' | 'resolved';

  @ApiPropertyOptional({ description: 'Open and in review together' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unresolved?: boolean;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'normal'] })
  @IsOptional()
  @IsIn(['critical', 'high', 'normal'])
  severity?: 'critical' | 'high' | 'normal';

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TARGETS })
  @IsOptional()
  @IsIn(TARGETS)
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  targetId?: string;
}

export class AssignReportDto {
  @ApiProperty({ description: 'A super admin or support admin' })
  @IsMongoId()
  assigneeId!: string;
}

export class ReportCommentDto {
  @ApiProperty({ example: 'Called the school; they are checking.' })
  @IsString()
  @Length(1, 2000)
  body!: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ReportOutcome })
  @IsEnum(ReportOutcome)
  outcome!: ReportOutcome;

  @ApiPropertyOptional({ example: 'Course hidden until the teacher fixes it' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AlertsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'resolved'] })
  @IsOptional()
  @IsIn(['open', 'acknowledged', 'resolved'])
  status?: 'open' | 'acknowledged' | 'resolved';

  @ApiPropertyOptional({ enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'normal'] })
  @IsOptional()
  @IsIn(['critical', 'high', 'normal'])
  severity?: string;
}

export class UpdateAlertDto {
  @ApiProperty({ enum: ['open', 'acknowledged', 'resolved'] })
  @IsIn(['open', 'acknowledged', 'resolved'])
  status!: 'open' | 'acknowledged' | 'resolved';

  @ApiPropertyOptional({ example: 'Checked: a school computer lab' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
