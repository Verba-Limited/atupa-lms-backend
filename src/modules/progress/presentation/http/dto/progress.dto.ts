import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class LessonPositionDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @ApiPropertyOptional({
    description: 'Index of the lesson block the learner is on',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  lastBlockIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  lastActivityId?: string;
}

export class HeartbeatDto {
  @ApiProperty({
    description:
      'Seconds of active learning since the last heartbeat (max 300)',
  })
  @IsInt()
  @Min(1)
  @Max(3600)
  seconds!: number;
}

export class RecentActivityQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
