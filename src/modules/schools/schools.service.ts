import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from './schemas/school.schema';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectModel(School.name) private readonly schoolModel: Model<School>,
  ) {}

  create(name: string, region?: string) {
    return this.schoolModel.create({ name, region });
  }

  list(): Promise<SchoolDocument[]> {
    return this.schoolModel.find().sort({ name: 1 }).exec();
  }
}
