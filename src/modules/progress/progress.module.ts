import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog';
import { LibraryModule } from '../library';
import {
  ACTIVITY_COMPLETION_REPOSITORY,
  ENROLLMENT_REPOSITORY,
  LEARNER_STATS_REPOSITORY,
  LEARNING_EVENT_REPOSITORY,
  LESSON_PROGRESS_REPOSITORY,
  QUIZ_RESULT_REPOSITORY,
} from './application/ports/progress.repositories.port';
import { ProgressQueryService } from './application/progress-query.service';
import { ProgressService } from './application/progress.service';
import {
  ActivityCompletionMongoRepository,
  EnrollmentMongoRepository,
  LearnerStatsMongoRepository,
  LearningEventMongoRepository,
  LessonProgressMongoRepository,
  QuizResultMongoRepository,
} from './infrastructure/persistence/progress.mongo-repositories';
import {
  ActivityCompletionRecord,
  ActivityCompletionSchema,
  EnrollmentRecord,
  EnrollmentSchema,
  LearnerStatsRecord,
  LearnerStatsSchema,
  LearningEventRecord,
  LearningEventSchema,
  LessonProgressRecord,
  LessonProgressSchema,
  QuizResultRecord,
  QuizResultSchema,
} from './infrastructure/persistence/progress.schemas';
import { ProgressListeners } from './presentation/events/progress.listeners';
import { ProgressController } from './presentation/http/progress.controller';

@Module({
  imports: [
    CatalogModule,
    LibraryModule,
    MongooseModule.forFeature([
      { name: EnrollmentRecord.name, schema: EnrollmentSchema },
      { name: LessonProgressRecord.name, schema: LessonProgressSchema },
      { name: ActivityCompletionRecord.name, schema: ActivityCompletionSchema },
      { name: QuizResultRecord.name, schema: QuizResultSchema },
      { name: LearnerStatsRecord.name, schema: LearnerStatsSchema },
      { name: LearningEventRecord.name, schema: LearningEventSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [
    ProgressService,
    ProgressQueryService,
    ProgressListeners,
    { provide: ENROLLMENT_REPOSITORY, useClass: EnrollmentMongoRepository },
    {
      provide: LESSON_PROGRESS_REPOSITORY,
      useClass: LessonProgressMongoRepository,
    },
    {
      provide: ACTIVITY_COMPLETION_REPOSITORY,
      useClass: ActivityCompletionMongoRepository,
    },
    { provide: QUIZ_RESULT_REPOSITORY, useClass: QuizResultMongoRepository },
    {
      provide: LEARNER_STATS_REPOSITORY,
      useClass: LearnerStatsMongoRepository,
    },
    {
      provide: LEARNING_EVENT_REPOSITORY,
      useClass: LearningEventMongoRepository,
    },
  ],
  exports: [ProgressService, ProgressQueryService],
})
export class ProgressModule {}
