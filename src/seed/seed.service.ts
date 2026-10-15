import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { ContentStatus, ProficiencyLevel } from '../shared/domain/enums';
import { UserRole } from '../shared/domain/user-role';
import {
  ActivityType,
  CourseAuthoringService,
  LanguagesService,
  LessonBlockType,
  QuestionType,
} from '../modules/catalog';
import { GamecardService } from '../modules/gamecard';
import { CulturalCategory, LibraryService } from '../modules/library';
import type { Actor } from '../shared/application/actor';

const LANGUAGES = [
  { code: 'yoruba', name: 'Yoruba', nativeName: 'Èdè Yorùbá', order: 1 },
  { code: 'igbo', name: 'Igbo', nativeName: 'Asụsụ Igbo', order: 2 },
  { code: 'hausa', name: 'Hausa', nativeName: 'Harshen Hausa', order: 3 },
];

/** Greetings and animal vocabulary per language (PRD sections 10 and 12). */
const CONTENT: Record<
  string,
  {
    goodMorning: string;
    thankYou: string;
    lion: string;
    dog: string;
    cat: string;
  }
> = {
  yoruba: {
    goodMorning: 'Ẹ kú àárọ̀',
    thankYou: 'Ẹ ṣé',
    lion: 'Kìnnìún',
    dog: 'Ajá',
    cat: 'Ológbò',
  },
  igbo: {
    goodMorning: 'Ụtụtụ ọma',
    thankYou: 'Daalụ',
    lion: 'Ọdụm',
    dog: 'Nkịta',
    cat: 'Nwamba',
  },
  hausa: {
    goodMorning: 'Ina kwana',
    thankYou: 'Na gode',
    lion: 'Zaki',
    dog: 'Kare',
    cat: 'Kyanwa',
  },
};

const SYSTEM: Actor = {
  userId: 'system-seed',
  email: 'seed@atupa.local',
  role: UserRole.SUPER_ADMIN,
};

/**
 * Seeds Yoruba, Igbo and Hausa (always) and demo content (unless
 * SEED_DEMO_CONTENT=false) on an empty database. Uses the application
 * services so seeded data follows the same rules as real content.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly languages: LanguagesService,
    private readonly authoring: CourseAuthoringService,
    private readonly library: LibraryService,
    private readonly gamecard: GamecardService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.languages.list(true);
    if (existing.length) return;
    for (const language of LANGUAGES) await this.languages.create(language);
    this.logger.log('Seeded languages: Yoruba, Igbo, Hausa');
    if (!this.config.seedDemoContent) return;
    for (const language of LANGUAGES)
      await this.seedLanguage(language.code, language.name);
    await this.library.createTopic({
      title: 'Traditional greetings across Nigeria',
      category: CulturalCategory.GREETINGS,
      summary: 'Why greetings matter and how respect is shown to elders.',
      blocks: [
        {
          type: 'text',
          content:
            'Greeting elders properly is a sign of respect. In Yoruba culture, boys may prostrate and girls may kneel when greeting elders.',
        },
      ],
      status: ContentStatus.PUBLISHED,
    });
    this.logger.log(
      'Seeded demo courses, vocabulary, GameCards and a cultural topic',
    );
  }

  private async seedLanguage(code: string, name: string) {
    const words = CONTENT[code];
    const vocab = [
      {
        conceptKey: 'good_morning',
        term: words.goodMorning,
        meaning: 'Good morning',
        category: 'greetings',
      },
      {
        conceptKey: 'thank_you',
        term: words.thankYou,
        meaning: 'Thank you',
        category: 'greetings',
      },
      {
        conceptKey: 'lion',
        term: words.lion,
        meaning: 'Lion',
        category: 'animals',
      },
      {
        conceptKey: 'dog',
        term: words.dog,
        meaning: 'Dog',
        category: 'animals',
      },
      {
        conceptKey: 'cat',
        term: words.cat,
        meaning: 'Cat',
        category: 'animals',
      },
    ];
    for (const v of vocab) {
      await this.library.createVocabulary({
        ...v,
        languageCode: code,
        level: ProficiencyLevel.BEGINNER,
      });
    }
    const cardCode = `${code.slice(0, 3).toUpperCase()}-LION`;
    await this.gamecard.createCard({
      code: cardCode,
      conceptKey: 'lion',
      languageCode: code,
      title: `${words.lion} (Lion)`,
      challenge: {
        prompt: `How do you say "lion" in ${name}?`,
        choices: [words.lion, words.dog, words.cat],
        answer: words.lion,
      },
    });

    for (const level of Object.values(ProficiencyLevel)) {
      const course = await this.authoring.createCourse(SYSTEM, {
        languageCode: code,
        level,
        title: `${name} ${level[0].toUpperCase()}${level.slice(1)}`,
        description: `Learn ${name} at ${level} level through lessons, games and quizzes.`,
        durationMinutes: 120,
        isPremium: level === ProficiencyLevel.ADVANCED,
      });
      const greetings = await this.authoring.createModule(SYSTEM, course.id, {
        title: 'Module 1: Greetings',
      });
      const lesson = await this.authoring.createLesson(SYSTEM, greetings.id, {
        title: 'Basic Greetings',
        estimatedMinutes: 10,
        blocks: [
          {
            type: LessonBlockType.TEXT,
            content: `English: Good morning\n${name}: ${words.goodMorning}`,
          },
          {
            type: LessonBlockType.CULTURAL_NOTE,
            content: 'Learn when and how the expression is traditionally used.',
          },
        ],
        vocabulary: [words.goodMorning, words.thankYou],
        culturalNotes: [
          'Greetings vary by time of day and by the age of the person.',
        ],
      });
      await this.authoring.createActivity(SYSTEM, lesson.id, {
        type: ActivityType.MULTIPLE_CHOICE,
        prompt: 'Which phrase means "Good morning"?',
        payload: { choices: [words.goodMorning, words.thankYou] },
        solution: words.goodMorning,
      });
      await this.authoring.setLessonStatus(
        SYSTEM,
        lesson.id,
        ContentStatus.PUBLISHED,
      );

      const animals = await this.authoring.createModule(SYSTEM, course.id, {
        title: 'Module 2: Animals',
      });
      const animalLesson = await this.authoring.createLesson(
        SYSTEM,
        animals.id,
        {
          title: 'Animal vocabulary',
          estimatedMinutes: 10,
          blocks: [
            {
              type: LessonBlockType.TEXT,
              content: `Lion: ${words.lion}\nDog: ${words.dog}\nCat: ${words.cat}`,
            },
          ],
          vocabulary: [words.lion, words.dog, words.cat],
          gamecardCodes: [cardCode],
        },
      );
      await this.authoring.createActivity(SYSTEM, animalLesson.id, {
        type: ActivityType.MATCHING,
        prompt: 'Match each animal to its name',
        payload: {
          left: ['Lion', 'Dog', 'Cat'],
          right: [words.cat, words.lion, words.dog],
        },
        solution: { Lion: words.lion, Dog: words.dog, Cat: words.cat },
      });
      await this.authoring.setLessonStatus(
        SYSTEM,
        animalLesson.id,
        ContentStatus.PUBLISHED,
      );

      await this.authoring.createQuiz(SYSTEM, course.id, {
        moduleId: greetings.id,
        title: 'Greetings quiz',
        passScorePercent: 70,
        questions: [
          {
            type: QuestionType.MULTIPLE_CHOICE,
            prompt: 'How do you say "Good morning"?',
            options: { choices: [words.goodMorning, words.thankYou] },
            correctAnswer: words.goodMorning,
            explanation: `"${words.goodMorning}" is the morning greeting.`,
          },
          {
            type: QuestionType.TRANSLATION,
            prompt: `Translate "Thank you" into ${name}`,
            correctAnswer: words.thankYou,
          },
        ],
      });
      await this.authoring.publishCourse(SYSTEM, course.id);
    }
  }
}
