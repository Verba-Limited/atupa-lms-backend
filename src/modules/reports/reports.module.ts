import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from '../catalog/schemas/course.schema';
import {
  LearnerProgress,
  LearnerProgressSchema,
} from '../progress/schemas/learner-progress.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearnerProgress.name, schema: LearnerProgressSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
