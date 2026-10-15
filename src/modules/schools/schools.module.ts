import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity';
import { SCHOOL_REPOSITORY } from './application/ports/school.repository.port';
import { SchoolsService } from './application/schools.service';
import { SchoolMongoRepository } from './infrastructure/persistence/school.mongo-repository';
import {
  SchoolRecord,
  SchoolSchema,
} from './infrastructure/persistence/school.schema';
import { SchoolsController } from './presentation/http/schools.controller';

@Module({
  imports: [
    IdentityModule,
    MongooseModule.forFeature([
      { name: SchoolRecord.name, schema: SchoolSchema },
    ]),
  ],
  controllers: [SchoolsController],
  providers: [
    SchoolsService,
    { provide: SCHOOL_REPOSITORY, useClass: SchoolMongoRepository },
  ],
  exports: [SchoolsService],
})
export class SchoolsModule {}
