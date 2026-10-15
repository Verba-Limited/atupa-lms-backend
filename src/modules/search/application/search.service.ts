import { Injectable } from '@nestjs/common';
import { ProficiencyLevel } from '../../../shared/domain/enums';
import { containsPattern } from '../../../shared/domain/text';
import { AgeGroup, CatalogQueryService, CourseType } from '../../catalog';
import { LibraryService } from '../../library';

export const SEARCH_SECTIONS = [
  'courses',
  'lessons',
  'languages',
  'vocabulary',
  'cultural_topics',
  'games',
] as const;
export type SearchSection = (typeof SEARCH_SECTIONS)[number];

export interface SearchInput {
  q: string;
  types?: SearchSection[];
  languageCode?: string;
  level?: ProficiencyLevel;
  ageGroup?: AgeGroup;
  courseType?: CourseType;
  maxDurationMinutes?: number;
  limit: number;
}

/** Search & discovery (PRD section 26) across catalog and library. */
@Injectable()
export class SearchService {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly library: LibraryService,
  ) {}

  async search(input: SearchInput) {
    const q = input.q.trim();
    const wants = (s: SearchSection) =>
      !input.types?.length || input.types.includes(s);
    const page = { page: 1, limit: input.limit };
    const courseFilter = {
      q: q || undefined,
      languageCode: input.languageCode,
      level: input.level,
      ageGroup: input.ageGroup,
      courseType: input.courseType,
      maxDurationMinutes: input.maxDurationMinutes,
    };

    const [courses, lessons, languages, vocabulary, culturalTopics, games] =
      await Promise.all([
        wants('courses')
          ? this.catalog
              .listPublishedCourses(courseFilter, page)
              .then((p) => p.items)
          : [],
        wants('lessons') && q
          ? this.searchLessons(q, courseFilter, input.limit)
          : [],
        wants('languages') ? this.searchLanguages(q) : [],
        wants('vocabulary')
          ? this.library
              .listVocabulary(
                {
                  q: q || undefined,
                  languageCode: input.languageCode,
                  level: input.level,
                },
                page,
              )
              .then((p) => p.items)
          : [],
        wants('cultural_topics')
          ? this.library
              .listTopics(
                {
                  q: q || undefined,
                  languageCode: input.languageCode,
                  ageGroup: input.ageGroup,
                },
                page,
              )
              .then((p) => p.items)
          : [],
        wants('games')
          ? this.library
              .listGames(
                { q: q || undefined, languageCode: input.languageCode },
                page,
              )
              .then((p) => p.items)
          : [],
      ]);

    return {
      query: q,
      courses,
      lessons,
      languages,
      vocabulary,
      culturalTopics,
      games,
    };
  }

  /** Lessons are only returned when their course is published and matches the filters. */
  private async searchLessons(
    q: string,
    courseFilter: Parameters<CatalogQueryService['listPublishedCourses']>[0],
    limit: number,
  ) {
    const { q: _q, ...filters } = courseFilter;
    void _q;
    const courses = await this.catalog.listPublishedCourses(filters, {
      page: 1,
      limit: 100,
    });
    if (!courses.items.length) return [];
    const byId = new Map(courses.items.map((c) => [c.id, c]));
    const lessons = await this.catalog.listPublishedLessons(
      { q, courseIds: [...byId.keys()] },
      limit,
    );
    return lessons.map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      courseId: l.courseId,
      courseTitle: byId.get(l.courseId)?.title,
      languageCode: byId.get(l.courseId)?.languageCode,
    }));
  }

  private async searchLanguages(q: string) {
    const languages = await this.catalog.listLanguages();
    if (!q) return languages;
    const pattern = containsPattern(q);
    return languages.filter(
      (l) =>
        pattern.test(l.name) ||
        pattern.test(l.nativeName ?? '') ||
        pattern.test(l.code),
    );
  }
}
