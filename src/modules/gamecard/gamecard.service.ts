import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProgressService } from '../progress/progress.service';
import { GamecardScan, GamecardScanDocument } from './schemas/gamecard-scan.schema';

@Injectable()
export class GamecardService {
  constructor(
    @InjectModel(GamecardScan.name)
    private readonly scanModel: Model<GamecardScan>,
    private readonly progressService: ProgressService,
  ) {}

  async recordScan(input: {
    userId: string;
    qrPayload: string;
    languageCode?: string;
    word?: string;
    lessonId?: string;
  }) {
    const scan = await this.scanModel.create({
      userId: input.userId,
      qrPayload: input.qrPayload,
      languageCode: input.languageCode,
      word: input.word,
      lessonId: input.lessonId,
    });
    await this.progressService.recordGamecardScan(input.userId, {
      qrPayload: input.qrPayload,
      languageCode: input.languageCode,
      word: input.word,
    });
    return scan;
  }

  listScans(userId: string): Promise<GamecardScanDocument[]> {
    return this.scanModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }
}
