import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../../config/app-config';
import { CatalogModule } from '../catalog';
import { LibraryModule } from '../library';
import { SubscriptionsModule } from '../subscriptions';
import {
  GAMECARD_SCAN_BASE_URL,
  GamecardService,
} from './application/gamecard.service';
import {
  GAMECARD_REPOSITORY,
  PLAY_RECORD_REPOSITORY,
} from './application/ports/gamecard.ports';
import {
  GameCardMongoRepository,
  PlayRecordMongoRepository,
} from './infrastructure/persistence/gamecard.mongo-repositories';
import {
  GameCardRecord,
  GameCardSchema,
  PlayRecordRecord,
  PlayRecordSchema,
} from './infrastructure/persistence/gamecard.schemas';
import {
  GamecardAuthoringController,
  GamecardController,
} from './presentation/http/gamecard.controller';

@Module({
  imports: [
    LibraryModule,
    CatalogModule,
    SubscriptionsModule,
    MongooseModule.forFeature([
      { name: GameCardRecord.name, schema: GameCardSchema },
      { name: PlayRecordRecord.name, schema: PlayRecordSchema },
    ]),
  ],
  controllers: [GamecardController, GamecardAuthoringController],
  providers: [
    GamecardService,
    { provide: GAMECARD_REPOSITORY, useClass: GameCardMongoRepository },
    { provide: PLAY_RECORD_REPOSITORY, useClass: PlayRecordMongoRepository },
    {
      provide: GAMECARD_SCAN_BASE_URL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => `${config.frontendUrl}/scan`,
    },
  ],
  exports: [GamecardService],
})
export class GamecardModule {}
