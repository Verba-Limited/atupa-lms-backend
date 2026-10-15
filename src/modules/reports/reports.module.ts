import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments';
import { CatalogModule } from '../catalog';
import { CertificatesModule } from '../certificates';
import { ClassesModule } from '../classes';
import { GamecardModule } from '../gamecard';
import { IdentityModule } from '../identity';
import { LearningModule } from '../learning';
import { ParentsModule } from '../parents';
import { ProgressModule } from '../progress';
import { SchoolsModule } from '../schools';
import { SubscriptionsModule } from '../subscriptions';
import { DashboardsService } from './application/dashboards.service';
import { LeaderboardsService } from './application/leaderboards.service';
import { LearnerAccessService } from './application/learner-access.service';
import { LearnerInsightsService } from './application/learner-insights.service';
import { ReportsService } from './application/reports.service';
import {
  DashboardsController,
  ReportsController,
} from './presentation/http/reports.controller';

/** Read-side composition over the other modules' public facades. */
@Module({
  imports: [
    IdentityModule,
    CatalogModule,
    ProgressModule,
    CertificatesModule,
    ClassesModule,
    AssignmentsModule,
    ParentsModule,
    SchoolsModule,
    GamecardModule,
    SubscriptionsModule,
    LearningModule,
  ],
  controllers: [DashboardsController, ReportsController],
  providers: [
    DashboardsService,
    ReportsService,
    LeaderboardsService,
    LearnerAccessService,
    LearnerInsightsService,
  ],
})
export class ReportsModule {}
