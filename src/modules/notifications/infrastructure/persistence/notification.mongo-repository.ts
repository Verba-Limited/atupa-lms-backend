import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import {
  isObjectId,
  paginate,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import { NotificationRepository } from '../../application/ports/notification.ports';
import {
  InAppNotification,
  NewNotification,
} from '../../domain/notification.entity';
import { NotificationRecord } from './notification.schema';

@Injectable()
export class NotificationMongoRepository implements NotificationRepository {
  constructor(
    @InjectModel(NotificationRecord.name)
    private readonly model: Model<NotificationRecord>,
  ) {}

  async createMany(items: NewNotification[]) {
    if (items.length) await this.model.insertMany(items, { ordered: false });
  }

  list(userId: string, unreadOnly: boolean, page: PageRequest) {
    return paginate<InAppNotification>(
      this.model,
      { userId, ...(unreadOnly ? { readAt: null } : {}) },
      page,
      { createdAt: -1 },
    );
  }

  countUnread(userId: string) {
    return this.model.countDocuments({ userId, readAt: null }).exec();
  }

  async markRead(userId: string, id: string) {
    if (!isObjectId(id)) return false;
    const res = await this.model
      .updateOne({ _id: id, userId }, { $set: { readAt: new Date() } })
      .exec();
    return res.matchedCount > 0;
  }

  async markAllRead(userId: string) {
    const res = await this.model
      .updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } })
      .exec();
    return res.modifiedCount;
  }
}
