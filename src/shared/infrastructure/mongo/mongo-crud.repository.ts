import { Model } from 'mongoose';
import { Page, PageRequest } from '../../domain/pagination';
import { isObjectId, paginate, toEntities, toEntity } from './mongo-mapper';

/**
 * Small reusable base for Mongo-backed repository adapters. Concrete adapters
 * extend it and add aggregate-specific queries; application code only sees
 * the port interfaces.
 */
export abstract class MongoCrudRepository<T extends { id: string }> {
  protected constructor(protected readonly model: Model<any>) {}

  async findById(id: string): Promise<T | null> {
    if (!isObjectId(id)) return null;
    return toEntity<T>(await this.model.findById(id).lean().exec());
  }

  async findByIds(ids: string[]): Promise<T[]> {
    const valid = [...new Set(ids.filter(isObjectId))];
    if (!valid.length) return [];
    return toEntities<T>(
      await this.model
        .find({ _id: { $in: valid } })
        .lean()
        .exec(),
    );
  }

  async create(input: Omit<T, 'id'> | Partial<T>): Promise<T> {
    const created = (await this.model.create(input)) as {
      toObject(): { _id: unknown };
    };
    return toEntity<T>(created.toObject()) as T;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    if (!isObjectId(id)) return null;
    const { id: _ignored, ...rest } = patch as Partial<T> & { id?: string };
    void _ignored;
    return toEntity<T>(
      await this.model
        .findByIdAndUpdate(id, rest, { returnDocument: 'after' })
        .lean()
        .exec(),
    );
  }

  async delete(id: string): Promise<boolean> {
    if (!isObjectId(id)) return false;
    const res = await this.model.deleteOne({ _id: id }).exec();
    return res.deletedCount > 0;
  }

  protected async findOneBy(
    filter: Record<string, unknown>,
  ): Promise<T | null> {
    return toEntity<T>(await this.model.findOne(filter).lean().exec());
  }

  protected async findManyBy(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
    limit?: number,
  ): Promise<T[]> {
    let query = this.model.find(filter).sort(sort);
    if (limit) query = query.limit(limit);
    return toEntities<T>(await query.lean().exec());
  }

  protected paginateBy(
    filter: Record<string, unknown>,
    page: PageRequest,
    sort?: Record<string, 1 | -1>,
  ): Promise<Page<T>> {
    return paginate<T>(this.model, filter, page, sort);
  }
}
