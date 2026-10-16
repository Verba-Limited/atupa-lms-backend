import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity';
import { ParentsService } from './application/parents.service';
import {
  LINK_CODE_REPOSITORY,
  PARENT_LINK_REPOSITORY,
} from './application/ports/parents.ports';
import {
  LinkCodeMongoRepository,
  ParentLinkMongoRepository,
} from './infrastructure/persistence/parents.mongo-repositories';
import {
  LinkCodeRecord,
  LinkCodeSchema,
  ParentLinkRecord,
  ParentLinkSchema,
} from './infrastructure/persistence/parents.schemas';
import { ParentsListeners } from './presentation/events/parents.listeners';
import { ParentsController } from './presentation/http/parents.controller';

@Module({
  imports: [
    IdentityModule,
    MongooseModule.forFeature([
      { name: ParentLinkRecord.name, schema: ParentLinkSchema },
      { name: LinkCodeRecord.name, schema: LinkCodeSchema },
    ]),
  ],
  controllers: [ParentsController],
  providers: [
    ParentsService,
    ParentsListeners,
    { provide: PARENT_LINK_REPOSITORY, useClass: ParentLinkMongoRepository },
    { provide: LINK_CODE_REPOSITORY, useClass: LinkCodeMongoRepository },
  ],
  exports: [ParentsService],
})
export class ParentsModule {}
