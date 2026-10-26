import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog';
import { LibraryModule } from '../library';
import { MediaModule } from '../media';
import { SubscriptionsModule } from '../subscriptions';
import { LearningAccessService } from './application/learning-access.service';
import { LessonPlayerService } from './application/lesson-player.service';
import { QUIZ_ATTEMPT_REPOSITORY } from './application/ports/quiz-attempt.repository.port';
import { QuizAttemptsService } from './application/quiz-attempts.service';
import { QuizAttemptMongoRepository } from './infrastructure/persistence/quiz-attempt.mongo-repository';
import {
  QuizAttemptRecord,
  QuizAttemptSchema,
} from './infrastructure/persistence/quiz-attempt.schema';
import { LearningController } from './presentation/http/learning.controller';

@Module({
  imports: [
    CatalogModule,
    SubscriptionsModule,
    MediaModule,
    LibraryModule,
    MongooseModule.forFeature([
      { name: QuizAttemptRecord.name, schema: QuizAttemptSchema },
    ]),
  ],
  controllers: [LearningController],
  providers: [
    LessonPlayerService,
    QuizAttemptsService,
    LearningAccessService,
    { provide: QUIZ_ATTEMPT_REPOSITORY, useClass: QuizAttemptMongoRepository },
  ],
  exports: [QuizAttemptsService, LearningAccessService],
})
export class LearningModule {}
