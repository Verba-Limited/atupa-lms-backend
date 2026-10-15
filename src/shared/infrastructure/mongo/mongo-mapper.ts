import { isValidObjectId, Model, Types } from 'mongoose';
import { Page, PageRequest, toSkip } from '../../domain/pagination';

type WithMongoId = { _id: unknown; __v?: unknown };

/** Converts a lean Mongo document into a plain domain object with `id`. */
export function toEntity<T extends { id: string }>(
  doc: WithMongoId | null | undefined,
): T | null {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc as WithMongoId & Record<string, unknown>;
  void __v;
  return { id: String(_id), ...rest } as unknown as T;
}

export function toEntities<T extends { id: string }>(docs: WithMongoId[]): T[] {
  return docs.map((doc) => toEntity<T>(doc) as T);
}

export function isObjectId(id: string | undefined | null): id is string {
  return !!id && isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id);
}

export function objectIds(ids: string[]): Types.ObjectId[] {
  return ids.filter(isObjectId).map((id) => new Types.ObjectId(id));
}

/** Runs a filtered, sorted, paginated query and returns domain entities. */
export async function paginate<T extends { id: string }>(
  model: Model<any>,
  filter: Record<string, unknown>,
  page: PageRequest,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
  projection?: Record<string, 0 | 1>,
): Promise<Page<T>> {
  const [docs, total] = await Promise.all([
    model
      .find(filter, projection)
      .sort(sort)
      .skip(toSkip(page))
      .limit(page.limit)
      .lean()
      .exec(),
    model.countDocuments(filter).exec(),
  ]);
  return {
    items: toEntities<T>(docs as WithMongoId[]),
    page: page.page,
    limit: page.limit,
    total,
  };
}
