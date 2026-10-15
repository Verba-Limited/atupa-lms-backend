import { Controller, Get, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProficiencyLevel } from '../../../../shared/domain/enums';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { AgeGroup, CourseType } from '../../../catalog';
import {
  SEARCH_SECTIONS,
  SearchSection,
  SearchService,
} from '../../application/search.service';

export class SearchQueryDto {
  @ApiPropertyOptional({ example: 'greetings' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q: string = '';

  @ApiPropertyOptional({
    description: `Comma-separated: ${SEARCH_SECTIONS.join(', ')}`,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value,
  )
  @IsIn(SEARCH_SECTIONS, { each: true })
  types?: SearchSection[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  languageCode?: string;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  level?: ProficiencyLevel;

  @ApiPropertyOptional({ enum: AgeGroup })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional({ enum: CourseType })
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDurationMinutes?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async run(@Query() query: SearchQueryDto) {
    return ok(await this.search.search({ ...query, q: query.q ?? '' }));
  }
}
