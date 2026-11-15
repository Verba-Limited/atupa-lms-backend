import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog';
import { ClassesModule } from '../classes';
import { IdentityModule } from '../identity';
import { MediaModule } from '../media';
import { SchoolsModule } from '../schools';
import { SubscriptionsModule } from '../subscriptions';
import { AlertsService } from './application/alerts.service';
import {
  ALERT_REPOSITORY,
  SAFETY_REPORT_REPOSITORY,
  SIGNAL_REPOSITORY,
} from './application/ports/safety.repositories.port';
import { SafetyReportsService } from './application/safety-reports.service';
import {
  AlertMongoRepository,
  SafetyReportMongoRepository,
  SignalMongoRepository,
} from './infrastructure/persistence/safety.mongo-repositories';
import {
  AlertRecord,
  AlertSchema,
  SafetyReportRecord,
  SafetyReportSchema,
  SignalRecord,
  SignalSchema,
} from './infrastructure/persistence/safety.schemas';
import { ActivityDetectors } from './presentation/events/activity-detectors';
import {
  AdminAlertsController,
  AdminSafetyReportsController,
  SafetyReportsController,
} from './presentation/http/safety.controller';

/** Trust & safety: learner reports, the reports queue and activity alerts. */
@Module({
  imports: [
    IdentityModule,
    SchoolsModule,
    CatalogModule,
    ClassesModule,
    MediaModule,
    SubscriptionsModule,
    MongooseModule.forFeature([
      { name: SafetyReportRecord.name, schema: SafetyReportSchema },
      { name: AlertRecord.name, schema: AlertSchema },
      { name: SignalRecord.name, schema: SignalSchema },
    ]),
  ],
  controllers: [
    SafetyReportsController,
    AdminSafetyReportsController,
    AdminAlertsController,
  ],
  providers: [
    SafetyReportsService,
    AlertsService,
    ActivityDetectors,
    {
      provide: SAFETY_REPORT_REPOSITORY,
      useClass: SafetyReportMongoRepository,
    },
    { provide: ALERT_REPOSITORY, useClass: AlertMongoRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalMongoRepository },
  ],
  exports: [SafetyReportsService, AlertsService],
})
export class SafetyModule {}
