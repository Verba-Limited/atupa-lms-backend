import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import {
  LearnerProgress,
  LearnerProgressSchema,
} from './schemas/learner-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearnerProgress.name, schema: LearnerProgressSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService, MongooseModule],
})
export class ProgressModule {}
