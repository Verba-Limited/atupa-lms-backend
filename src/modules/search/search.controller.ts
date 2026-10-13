import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProficiencyLevel } from '../../common/enums/proficiency-level.enum';
import { ok } from '../../common/utils/api-response';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query('q') q: string,
    @Query('languageCode') languageCode?: string,
    @Query('level') level?: ProficiencyLevel,
    @Query('ageGroup') ageGroup?: string,
    @Query('maxDurationMinutes') maxDurationMinutes?: string,
  ) {
    return this.searchService
      .search({
        q: q ?? '',
        languageCode,
        level,
        ageGroup,
        maxDurationMinutes: maxDurationMinutes
          ? Number(maxDurationMinutes)
          : undefined,
      })
      .then((data) => ok(data));
  }
}
