import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { toEntity } from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  LinkCodeRepository,
  ParentLinkRepository,
} from '../../application/ports/parents.ports';
import { LinkCode, ParentLink } from '../../domain/parent-link.entities';
import { LinkCodeRecord, ParentLinkRecord } from './parents.schemas';

@Injectable()
export class ParentLinkMongoRepository
  implements ParentLinkRepository, OnModuleInit
{
  constructor(
    @InjectModel(ParentLinkRecord.name)
    private readonly model: Model<ParentLinkRecord>,
  ) {}

  /** Moves links stored on the prototype's users.linkedChildIds. */
  async onModuleInit() {
    const users = this.model.db.collection('users');
    const legacy = users.find({ linkedChildIds: { $exists: true, $ne: [] } });
    for await (const parent of legacy) {
      for (const childId of parent.linkedChildIds as string[]) {
        await this.link(String(parent._id), childId);
      }
      await users.updateOne(
        { _id: parent._id },
        { $unset: { linkedChildIds: '' } },
      );
    }
  }

  async link(parentId: string, childId: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { parentId, childId },
        { $setOnInsert: { parentId, childId } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean()
      .exec();
    return toEntity<ParentLink>(doc) as ParentLink;
  }

  async unlink(parentId: string, childId: string) {
    return (
      (await this.model.deleteOne({ parentId, childId }).exec()).deletedCount >
      0
    );
  }

  async exists(parentId: string, childId: string) {
    return !!(await this.model.exists({ parentId, childId }).exec());
  }

  async childIds(parentId: string) {
    return (await this.model.find({ parentId }).lean().exec()).map(
      (l) => l.childId,
    );
  }

  async parentIds(childId: string) {
    return (await this.model.find({ childId }).lean().exec()).map(
      (l) => l.parentId,
    );
  }

  async countParents() {
    return (await this.model.distinct('parentId').exec()).length;
  }
}

@Injectable()
export class LinkCodeMongoRepository implements LinkCodeRepository {
  constructor(
    @InjectModel(LinkCodeRecord.name)
    private readonly model: Model<LinkCodeRecord>,
  ) {}

  async replaceForLearner(
    learnerId: string,
    codeHash: string,
    expiresAt: Date,
  ) {
    await this.model.deleteMany({ learnerId }).exec();
    const doc = await this.model.create({
      learnerId,
      codeHash,
      expiresAt,
      usedAt: null,
    });
    return toEntity<LinkCode>(doc.toObject()) as LinkCode;
  }

  async consume(codeHash: string, now: Date) {
    return toEntity<LinkCode>(
      await this.model
        .findOneAndUpdate(
          { codeHash, usedAt: null, expiresAt: { $gt: now } },
          { $set: { usedAt: now } },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }
}
