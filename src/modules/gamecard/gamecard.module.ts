import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressModule } from '../progress/progress.module';
import { GamecardController } from './gamecard.controller';
import { GamecardService } from './gamecard.service';
import { GamecardScan, GamecardScanSchema } from './schemas/gamecard-scan.schema';

@Module({
  imports: [
    ProgressModule,
    MongooseModule.forFeature([
      { name: GamecardScan.name, schema: GamecardScanSchema },
    ]),
  ],
  controllers: [GamecardController],
  providers: [GamecardService],
})
export class GamecardModule {}
