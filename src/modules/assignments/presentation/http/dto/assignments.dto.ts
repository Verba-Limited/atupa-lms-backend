import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
  MinDate,
} from 'class-validator';
import { AssignmentType } from '../../../domain/assignment.entities';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsMongoId()
  classroomId!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  @ApiProperty({ enum: AssignmentType })
  @IsEnum(AssignmentType)
  type!: AssignmentType;

  @ApiPropertyOptional({
    description: 'Lesson, quiz or game id for those types',
  })
  @IsOptional()
  @IsMongoId()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date())
  dueAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Defaults to the whole class',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  learnerIds?: string[];
}

export class SubmitWorkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'URLs of uploaded submission media',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_protocol: true, require_tld: false }, { each: true })
  mediaUrls?: string[];
}

export class ReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @ApiPropertyOptional({ description: 'Also mark the assignment completed' })
  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
