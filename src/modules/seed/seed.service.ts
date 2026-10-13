import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ProficiencyLevel } from '../../common/enums/proficiency-level.enum';
import { Course } from '../catalog/schemas/course.schema';
import { Language } from '../catalog/schemas/language.schema';
import {
  LearningModule,
} from '../catalog/schemas/learning-module.schema';
import { Lesson } from '../catalog/schemas/lesson.schema';
import { Quiz, QuestionType } from '../catalog/schemas/quiz.schema';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Language.name) private readonly languageModel: Model<Language>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(LearningModule.name)
    private readonly moduleModel: Model<LearningModule>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<Lesson>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.languageModel.countDocuments().exec();
    if (count > 0) return;
    this.logger.log('Seeding ATUPA LMS baseline content...');
    await this.seed();
    this.logger.log('Seed complete');
  }

  private async seed() {
    const languages = await this.languageModel.insertMany([
      { code: 'yoruba', name: 'Yoruba' },
      { code: 'igbo', name: 'Igbo' },
      { code: 'hausa', name: 'Hausa' },
    ]);

    for (const language of languages) {
      for (const level of Object.values(ProficiencyLevel)) {
        const course = await this.courseModel.create({
          languageCode: language.code,
          level,
          title: `${language.name} ${level} Foundations`,
          description: `Introductory ${language.name} course for ${level} learners.`,
          status: ContentStatus.PUBLISHED,
          ageGroup: 'all',
          durationMinutes: 120,
        });
        const module = await this.moduleModel.create({
          courseId: course._id,
          title: 'Module 1: Greetings',
          order: 1,
        });
        const lesson = await this.lessonModel.create({
          courseId: course._id,
          moduleId: module._id,
          title: 'Everyday greetings',
          status: ContentStatus.PUBLISHED,
          order: 1,
          blocks: [
            { type: 'text', content: `Learn common ${language.name} greetings.` },
          ],
          vocabulary: ['hello', 'thank you'],
          pronunciationNotes: ['Listen and repeat slowly'],
          culturalNotes: ['Greetings vary by region and context'],
          gamecardQrCode: `${language.code}:hello`,
        });
        await this.quizModel.create({
          lessonId: lesson._id,
          title: 'Greetings check',
          passScorePercent: 70,
          questions: [
            {
              type: QuestionType.MULTIPLE_CHOICE,
              prompt: 'Choose the best greeting response',
              options: { choices: ['A', 'B', 'C'] },
              correctAnswer: 'A',
            },
          ],
        });
      }
    }
  }
}
