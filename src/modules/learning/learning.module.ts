import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog/catalog.module';
import { ProgressModule } from '../progress/progress.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { QuizScoringService } from './quiz-scoring.service';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema';
import { Quiz, QuizSchema } from '../catalog/schemas/quiz.schema';

@Module({
  imports: [
    CatalogModule,
    ProgressModule,
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
    ]),
  ],
  controllers: [LearningController],
  providers: [LearningService, QuizScoringService],
  exports: [LearningService, QuizScoringService],
})
export class LearningModule {}
