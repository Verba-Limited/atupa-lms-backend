import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog';
import { IdentityModule } from '../identity';
import { ClassesService } from './application/classes.service';
import { CLASSROOM_REPOSITORY } from './application/ports/classroom.repository.port';
import { ClassroomMongoRepository } from './infrastructure/persistence/classroom.mongo-repository';
import {
  ClassroomRecord,
  ClassroomSchema,
} from './infrastructure/persistence/classroom.schema';
import { ClassesListeners } from './presentation/events/classes.listeners';
import { ClassesController } from './presentation/http/classes.controller';

@Module({
  imports: [
    IdentityModule,
    CatalogModule,
    MongooseModule.forFeature([
      { name: ClassroomRecord.name, schema: ClassroomSchema },
    ]),
  ],
  controllers: [ClassesController],
  providers: [
    ClassesService,
    ClassesListeners,
    { provide: CLASSROOM_REPOSITORY, useClass: ClassroomMongoRepository },
  ],
  exports: [ClassesService],
})
export class ClassesModule {}
