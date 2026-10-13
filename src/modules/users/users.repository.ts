import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateUserInput,
  IUserRepository,
} from './interfaces/user-repository.interface';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository implements IUserRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create(input);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash?: string,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { refreshTokenHash: refreshTokenHash ?? null })
      .exec();
  }

  linkChild(parentId: string, childId: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        parentId,
        { $addToSet: { linkedChildIds: childId } },
        { new: true },
      )
      .exec();
  }
}
