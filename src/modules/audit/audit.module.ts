import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './application/audit.service';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.port';
import {
  AuditEntryRecord,
  AuditEntrySchema,
} from './infrastructure/persistence/audit-entry.schema';
import { AuditMongoRepository } from './infrastructure/persistence/audit.mongo-repository';
import { AuditController } from './presentation/http/audit.controller';
import { AuditInterceptor } from './presentation/http/audit.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEntryRecord.name, schema: AuditEntrySchema },
    ]),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: AUDIT_REPOSITORY, useClass: AuditMongoRepository },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
