import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogQueryService } from './application/catalog-query.service';
import { CourseAuthoringService } from './application/course-authoring.service';
import { LanguagesService } from './application/languages.service';
import {
  ACTIVITY_REPOSITORY,
  COURSE_REPOSITORY,
  LANGUAGE_REPOSITORY,
  LESSON_REPOSITORY,
  MODULE_REPOSITORY,
  QUIZ_REPOSITORY,
} from './application/ports/catalog.repositories.port';
import { CatalogMigrations } from './infrastructure/persistence/catalog.migrations';
import {
  ActivityMongoRepository,
  CourseMongoRepository,
  LanguageMongoRepository,
  LessonMongoRepository,
  ModuleMongoRepository,
  QuizMongoRepository,
} from './infrastructure/persistence/catalog.mongo-repositories';
import {
  ActivityRecord,
  ActivitySchema,
  CourseModuleRecord,
  CourseModuleSchema,
  CourseRecord,
  CourseSchema,
  LanguageRecord,
  LanguageSchema,
  LessonRecord,
  LessonSchema,
  QuizRecord,
  QuizSchema,
} from './infrastructure/persistence/catalog.schemas';
import { AuthoringController } from './presentation/http/authoring.controller';
import { CatalogController } from './presentation/http/catalog.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LanguageRecord.name, schema: LanguageSchema },
      { name: CourseRecord.name, schema: CourseSchema },
      { name: CourseModuleRecord.name, schema: CourseModuleSchema },
      { name: LessonRecord.name, schema: LessonSchema },
      { name: ActivityRecord.name, schema: ActivitySchema },
      { name: QuizRecord.name, schema: QuizSchema },
    ]),
  ],
  controllers: [CatalogController, AuthoringController],
  providers: [
    CatalogQueryService,
    CourseAuthoringService,
    LanguagesService,
    CatalogMigrations,
    { provide: LANGUAGE_REPOSITORY, useClass: LanguageMongoRepository },
    { provide: COURSE_REPOSITORY, useClass: CourseMongoRepository },
    { provide: MODULE_REPOSITORY, useClass: ModuleMongoRepository },
    { provide: LESSON_REPOSITORY, useClass: LessonMongoRepository },
    { provide: ACTIVITY_REPOSITORY, useClass: ActivityMongoRepository },
    { provide: QUIZ_REPOSITORY, useClass: QuizMongoRepository },
  ],
  exports: [CatalogQueryService, CourseAuthoringService, LanguagesService],
})
export class CatalogModule {}
