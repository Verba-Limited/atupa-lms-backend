import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ContentStatus,
  ProficiencyLevel,
} from '../../../../../shared/domain/enums';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { CulturalCategory, GameType } from '../../../domain/library.entities';

const URL_OPTS = { require_protocol: true, require_tld: false };

export class VocabularyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conceptKey?: string;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  level?: ProficiencyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class VocabularyDto {
  @ApiProperty({ example: 'yoruba' })
  @IsString()
  @MaxLength(30)
  languageCode!: string;

  @ApiProperty({ example: 'Kìnnìún' })
  @IsString()
  @Length(1, 120)
  term!: string;

  @ApiProperty({ example: 'Lion' })
  @IsString()
  @Length(1, 200)
  meaning!: string;

  @ApiProperty({ example: 'lion' })
  @IsString()
  @Length(1, 60)
  conceptKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pronunciation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleSentence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleTranslation?: string;

  @ApiPropertyOptional({ example: 'animals' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  level?: ProficiencyLevel;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
export class UpdateVocabularyDto extends PartialType(VocabularyDto) {}

export class CulturalBlockDto {
  @ApiProperty({ enum: ['text', 'image', 'audio', 'video'] })
  @IsIn(['text', 'image', 'audio', 'video'])
  type!: 'text' | 'image' | 'audio' | 'video';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  mediaUrl?: string;
}

export class CulturalTopicQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CulturalCategory })
  @IsOptional()
  @IsEnum(CulturalCategory)
  category?: CulturalCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ageGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CulturalTopicDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  title!: string;

  @ApiProperty({ enum: CulturalCategory })
  @IsEnum(CulturalCategory)
  category!: CulturalCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @ApiPropertyOptional({ type: [CulturalBlockDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CulturalBlockDto)
  blocks?: CulturalBlockDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  quizId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ageGroup?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
export class UpdateCulturalTopicDto extends PartialType(CulturalTopicDto) {}

export class GameQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional({ enum: GameType })
  @IsOptional()
  @IsEnum(GameType)
  gameType?: GameType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class GameDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: GameType })
  @IsEnum(GameType)
  gameType!: GameType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languageCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  launchUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conceptKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
export class UpdateGameDto extends PartialType(GameDto) {}
