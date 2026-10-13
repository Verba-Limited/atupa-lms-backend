import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from '../catalog/schemas/course.schema';
import { LearnerProgress } from '../progress/schemas/learner-progress.schema';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(LearnerProgress.name)
    private readonly progressModel: Model<LearnerProgress>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
  ) {}

  learnerReport(userId: string) {
    return this.progressModel.findOne({ userId }).exec();
  }

  async adminAnalytics() {
    const [users, courses, progressDocs] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.courseModel.countDocuments().exec(),
      this.progressModel.find().exec(),
    ]);

    const languageCounts = await this.courseModel.aggregate([
      { $group: { _id: '$languageCode', count: { $sum: 1 } } },
    ]);

    const completedCourses = progressDocs.reduce(
      (sum, doc) => sum + doc.completedCourseIds.length,
      0,
    );
    const gameEngagement = progressDocs.reduce(
      (sum, doc) =>
        sum +
        doc.recentActivities.filter((a) => a.type === 'gamecard_scan').length,
      0,
    );

    return {
      users,
      courses,
      languageCounts,
      completedCourses,
      gameEngagement,
    };
  }
}
