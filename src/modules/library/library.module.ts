import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from '../media';
import { LibraryService } from './application/library.service';
import {
  CULTURAL_TOPIC_REPOSITORY,
  GAME_REPOSITORY,
  VOCABULARY_REPOSITORY,
} from './application/ports/library.repositories.port';
import {
  CulturalTopicMongoRepository,
  GameMongoRepository,
  VocabularyMongoRepository,
} from './infrastructure/persistence/library.mongo-repositories';
import {
  CulturalTopicRecord,
  CulturalTopicSchema,
  GameRecord,
  GameSchema,
  VocabularyRecord,
  VocabularySchema,
} from './infrastructure/persistence/library.schemas';
import {
  LibraryAuthoringController,
  LibraryController,
} from './presentation/http/library.controller';

@Module({
  imports: [
    MediaModule,
    MongooseModule.forFeature([
      { name: VocabularyRecord.name, schema: VocabularySchema },
      { name: CulturalTopicRecord.name, schema: CulturalTopicSchema },
      { name: GameRecord.name, schema: GameSchema },
    ]),
  ],
  controllers: [LibraryController, LibraryAuthoringController],
  providers: [
    LibraryService,
    { provide: VOCABULARY_REPOSITORY, useClass: VocabularyMongoRepository },
    {
      provide: CULTURAL_TOPIC_REPOSITORY,
      useClass: CulturalTopicMongoRepository,
    },
    { provide: GAME_REPOSITORY, useClass: GameMongoRepository },
  ],
  exports: [LibraryService],
})
export class LibraryModule {}
