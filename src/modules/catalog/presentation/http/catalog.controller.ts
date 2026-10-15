import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../shared/domain/user-role';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { CatalogQueryService } from '../../application/catalog-query.service';
import { LanguagesService } from '../../application/languages.service';
import {
  CourseQueryDto,
  CreateLanguageDto,
  UpdateLanguageDto,
} from './dto/catalog.dto';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly languages: LanguagesService,
  ) {}

  @Public()
  @Get('languages')
  async listLanguages() {
    return ok(await this.languages.list());
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_CREATOR)
  @Get('admin/languages')
  async listAllLanguages() {
    return ok(await this.languages.list(true));
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_CREATOR)
  @Post('languages')
  async createLanguage(@Body() dto: CreateLanguageDto) {
    return ok(await this.languages.create(dto), 'Language created');
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_CREATOR)
  @Patch('languages/:code')
  async updateLanguage(
    @Param('code') code: string,
    @Body() dto: UpdateLanguageDto,
  ) {
    return ok(await this.languages.update(code, dto), 'Language updated');
  }

  /** Browse published courses by language, level and other filters. */
  @Public()
  @Get('courses')
  async listCourses(@Query() query: CourseQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.catalog.listPublishedCourses(filter, pageOf({ page, limit })),
    );
  }

  /** Course -> modules -> lessons outline (no lesson bodies, no answers). */
  @Public()
  @Get('courses/:courseId')
  async getCourse(@IdParam('courseId') courseId: string) {
    return ok(await this.catalog.getCourseOutline(courseId));
  }
}
