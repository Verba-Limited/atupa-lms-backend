import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProficiencyLevel } from '../../../../../shared/domain/enums';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { ActivityType } from '../../../domain/activity.entity';
import { AgeGroup, CourseType } from '../../../domain/course.entity';
import { LessonBlockType } from '../../../domain/lesson.entity';
import { QuestionType } from '../../../domain/quiz.entity';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

// ---- Languages ---------------------------------------------------------------

export class CreateLanguageDto {
  @ApiProperty({ example: 'edo' })
  @Matches(/^[a-z][a-z0-9_-]{1,29}$/, {
    message: 'code must be lowercase letters, digits, - or _',
  })
  code!: string;

  @ApiProperty({ example: 'Edo' })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nativeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateLanguageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nativeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

// ---- Courses -------------------------------------------------------------------

export class CourseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'yoruba' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  level?: ProficiencyLevel;

  @ApiPropertyOptional({ enum: CourseType })
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @ApiPropertyOptional({ enum: AgeGroup })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'yoruba' })
  @IsString()
  @MaxLength(30)
  languageCode!: string;

  @ApiProperty({ enum: ProficiencyLevel })
  @IsEnum(ProficiencyLevel)
  level!: ProficiencyLevel;

  @ApiProperty({ example: 'Yoruba Beginner' })
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: CourseType })
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @ApiPropertyOptional({ enum: AgeGroup })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

// ---- Modules & lessons --------------------------------------------------------

export class ModuleDto {
  @ApiProperty({ example: 'Module 1: Greetings' })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateModuleDto extends PartialType(ModuleDto) {}

export class LessonBlockDto {
  @ApiProperty({ enum: LessonBlockType })
  @IsEnum(LessonBlockType)
  type!: LessonBlockType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  mediaAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  refId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class LessonDto {
  @ApiProperty({ example: 'Basic Greetings' })
  @IsString()
  @Length(1, 160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @ApiPropertyOptional({ type: [LessonBlockDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LessonBlockDto)
  blocks?: LessonBlockDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  vocabulary?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  vocabularyIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pronunciationNotes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  culturalNotes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gamecardCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLessonDto extends PartialType(LessonDto) {}

// ---- Activities ------------------------------------------------------------------

export class ActivityDto {
  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  prompt?: string;

  @ApiProperty({
    description: 'Learner-visible content (choices, words, cards, media)',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Hidden answer key. Omit for flashcards.',
  })
  @IsOptional()
  solution?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ordered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  feedback?: { correct?: string; incorrect?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateActivityDto extends PartialType(ActivityDto) {}

// ---- Quizzes ------------------------------------------------------------------------

export class QuizQuestionDto {
  @ApiPropertyOptional({ description: 'Stable id; generated when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  prompt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  mediaUrl?: string;

  @ApiPropertyOptional({ example: { choices: ['Ẹ kú àárọ̀', 'Ẹ kú alẹ́'] } })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @ApiProperty({ description: 'string | string[] | { left: right }' })
  @IsDefined()
  correctAnswer!: string | string[] | Record<string, string>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedAnswers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ordered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;
}

export class QuizDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];

  @ApiPropertyOptional({ default: 70 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passScorePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(4 * 3600)
  timerSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowReview?: boolean;
}

export class UpdateQuizDto extends PartialType(QuizDto) {}
