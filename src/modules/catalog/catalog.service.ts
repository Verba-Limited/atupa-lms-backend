import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ProficiencyLevel } from '../../common/enums/proficiency-level.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import { Course, CourseDocument } from './schemas/course.schema';
import { Language, LanguageDocument } from './schemas/language.schema';
import {
  LearningModule,
  LearningModuleDocument,
} from './schemas/learning-module.schema';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { Quiz, QuizDocument } from './schemas/quiz.schema';

const CONTENT_MANAGER_ROLES = [
  UserRole.TEACHER,
  UserRole.CONTENT_CREATOR,
  UserRole.SCHOOL_ADMIN,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Language.name)
    private readonly languageModel: Model<Language>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(LearningModule.name)
    private readonly moduleModel: Model<LearningModule>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<Lesson>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<Activity>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  listLanguages(): Promise<LanguageDocument[]> {
    return this.languageModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  createLanguage(input: { code: string; name: string }) {
    return this.languageModel.create(input);
  }

  listCourses(filters: {
    languageCode?: string;
    level?: ProficiencyLevel;
    includeDrafts?: boolean;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.languageCode) query.languageCode = filters.languageCode;
    if (filters.level) query.level = filters.level;
    if (!filters.includeDrafts) query.status = ContentStatus.PUBLISHED;
    return this.courseModel.find(query).sort({ title: 1 }).exec();
  }

  async getCourseTree(courseId: string, includeDrafts = false) {
    const course = await this.courseModel.findById(courseId).exec();
    if (!course) throw new NotFoundException('Course not found');
    if (!includeDrafts && course.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }

    const modules = await this.moduleModel
      .find({ courseId: new Types.ObjectId(courseId) })
      .sort({ order: 1 })
      .exec();
    const moduleIds = modules.map((m) => m._id);
    const lessonQuery: Record<string, unknown> = {
      moduleId: { $in: moduleIds },
    };
    if (!includeDrafts) lessonQuery.status = ContentStatus.PUBLISHED;
    const lessons = await this.lessonModel
      .find(lessonQuery)
      .sort({ order: 1 })
      .exec();
    const lessonIds = lessons.map((l) => l._id);
    const [activities, quizzes] = await Promise.all([
      this.activityModel
        .find({ lessonId: { $in: lessonIds } })
        .sort({ order: 1 })
        .exec(),
      this.quizModel.find({ lessonId: { $in: lessonIds } }).exec(),
    ]);

    return { course, modules, lessons, activities, quizzes };
  }

  createCourse(
    role: UserRole,
    input: {
      languageCode: string;
      level: ProficiencyLevel;
      title: string;
      description?: string;
      ageGroup?: string;
      durationMinutes?: number;
      createdByUserId?: string;
    },
  ) {
    this.assertContentManager(role);
    return this.courseModel.create({ ...input, status: ContentStatus.DRAFT });
  }

  publishCourse(role: UserRole, courseId: string) {
    this.assertContentManager(role);
    return this.courseModel
      .findByIdAndUpdate(
        courseId,
        { status: ContentStatus.PUBLISHED },
        { new: true },
      )
      .exec();
  }

  unpublishCourse(role: UserRole, courseId: string) {
    this.assertContentManager(role);
    return this.courseModel
      .findByIdAndUpdate(
        courseId,
        { status: ContentStatus.DRAFT },
        { new: true },
      )
      .exec();
  }

  createModule(
    role: UserRole,
    input: { courseId: string; title: string; order?: number },
  ) {
    this.assertContentManager(role);
    return this.moduleModel.create({
      courseId: new Types.ObjectId(input.courseId),
      title: input.title,
      order: input.order ?? 0,
    });
  }

  createLesson(
    role: UserRole,
    input: {
      courseId: string;
      moduleId: string;
      title: string;
      blocks?: Lesson['blocks'];
      vocabulary?: string[];
      pronunciationNotes?: string[];
      culturalNotes?: string[];
      gamecardQrCode?: string;
      order?: number;
    },
  ) {
    this.assertContentManager(role);
    return this.lessonModel.create({
      ...input,
      courseId: new Types.ObjectId(input.courseId),
      moduleId: new Types.ObjectId(input.moduleId),
      status: ContentStatus.DRAFT,
      order: input.order ?? 0,
    });
  }

  publishLesson(role: UserRole, lessonId: string) {
    this.assertContentManager(role);
    return this.lessonModel
      .findByIdAndUpdate(
        lessonId,
        { status: ContentStatus.PUBLISHED },
        { new: true },
      )
      .exec();
  }

  createActivity(
    role: UserRole,
    input: {
      lessonId: string;
      type: Activity['type'];
      payload: Record<string, unknown>;
      order?: number;
    },
  ) {
    this.assertContentManager(role);
    return this.activityModel.create({
      lessonId: new Types.ObjectId(input.lessonId),
      type: input.type,
      payload: input.payload,
      order: input.order ?? 0,
    });
  }

  createQuiz(
    role: UserRole,
    input: {
      lessonId: string;
      title: string;
      questions: Quiz['questions'];
      passScorePercent?: number;
      timerSeconds?: number;
      randomizeQuestions?: boolean;
    },
  ) {
    this.assertContentManager(role);
    return this.quizModel.create({
      lessonId: new Types.ObjectId(input.lessonId),
      title: input.title,
      questions: input.questions,
      passScorePercent: input.passScorePercent ?? 70,
      timerSeconds: input.timerSeconds,
      randomizeQuestions: input.randomizeQuestions ?? false,
    });
  }

  private assertContentManager(role: UserRole): void {
    if (!CONTENT_MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('You cannot manage learning content');
    }
  }
}
