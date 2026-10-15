import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog';
import { ClassesModule } from '../classes';
import { LibraryModule } from '../library';
import { AssignmentsService } from './application/assignments.service';
import {
  ASSIGNMENT_REPOSITORY,
  SUBMISSION_REPOSITORY,
} from './application/ports/assignment.ports';
import {
  AssignmentMongoRepository,
  SubmissionMongoRepository,
} from './infrastructure/persistence/assignment.mongo-repositories';
import {
  AssignmentRecord,
  AssignmentSchema,
  SubmissionRecord,
  SubmissionSchema,
} from './infrastructure/persistence/assignment.schemas';
import { AssignmentsListeners } from './presentation/events/assignments.listeners';
import { AssignmentsController } from './presentation/http/assignments.controller';

@Module({
  imports: [
    ClassesModule,
    CatalogModule,
    LibraryModule,
    MongooseModule.forFeature([
      { name: AssignmentRecord.name, schema: AssignmentSchema },
      { name: SubmissionRecord.name, schema: SubmissionSchema },
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [
    AssignmentsService,
    AssignmentsListeners,
    { provide: ASSIGNMENT_REPOSITORY, useClass: AssignmentMongoRepository },
    { provide: SUBMISSION_REPOSITORY, useClass: SubmissionMongoRepository },
  ],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
