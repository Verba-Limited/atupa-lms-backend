import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { Course, CourseSchema } from './schemas/course.schema';
import { Language, LanguageSchema } from './schemas/language.schema';
import {
  LearningModule,
  LearningModuleSchema,
} from './schemas/learning-module.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Language.name, schema: LanguageSchema },
      { name: Course.name, schema: CourseSchema },
      { name: LearningModule.name, schema: LearningModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService, MongooseModule],
})
export class CatalogModule {}
