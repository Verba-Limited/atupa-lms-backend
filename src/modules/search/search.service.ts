import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ProficiencyLevel } from '../../common/enums/proficiency-level.enum';
import { Course } from '../catalog/schemas/course.schema';
import { Lesson } from '../catalog/schemas/lesson.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<Lesson>,
  ) {}

  async search(input: {
    q: string;
    languageCode?: string;
    level?: ProficiencyLevel;
    ageGroup?: string;
    courseType?: string;
    maxDurationMinutes?: number;
  }) {
    const regex = new RegExp(input.q.trim(), 'i');
    const courseQuery: Record<string, unknown> = {
      status: ContentStatus.PUBLISHED,
      $or: [{ title: regex }, { description: regex }],
    };
    if (input.languageCode) courseQuery.languageCode = input.languageCode;
    if (input.level) courseQuery.level = input.level;
    if (input.ageGroup) courseQuery.ageGroup = input.ageGroup;
    if (input.maxDurationMinutes) {
      courseQuery.durationMinutes = { $lte: input.maxDurationMinutes };
    }

    const [courses, lessons] = await Promise.all([
      this.courseModel.find(courseQuery).limit(20).exec(),
      this.lessonModel
        .find({
          status: ContentStatus.PUBLISHED,
          $or: [
            { title: regex },
            { vocabulary: regex },
            { culturalNotes: regex },
          ],
        })
        .limit(20)
        .exec(),
    ]);

    return {
      query: input.q,
      courses,
      lessons,
      games: courses.filter((c) =>
        String(c.title).toLowerCase().includes('game'),
      ),
    };
  }
}
