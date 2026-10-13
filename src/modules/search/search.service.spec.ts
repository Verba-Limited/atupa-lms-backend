import { SearchService } from './search.service';
import { Model } from 'mongoose';
import { Course } from '../catalog/schemas/course.schema';
import { Lesson } from '../catalog/schemas/lesson.schema';

describe('SearchService', () => {
  const courseModel = {
    find: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
  } as unknown as Model<Course>;
  const lessonModel = {
    find: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
  } as unknown as Model<Lesson>;

  const service = new SearchService(courseModel, lessonModel);

  it('returns structured search payload', async () => {
    const result = await service.search({ q: 'greeting' });
    expect(result).toHaveProperty('courses');
    expect(result).toHaveProperty('lessons');
    expect(result.query).toBe('greeting');
  });
});
