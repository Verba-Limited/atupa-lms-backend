import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { CatalogModule } from '../catalog';
import { ClassesModule } from '../classes';
import { IdentityModule } from '../identity';
import { LibraryModule } from '../library';
import { ProgressModule } from '../progress';
import { ReportsModule } from '../reports';
import { SafetyModule } from '../safety';
import { SchoolsModule } from '../schools';
import { SubscriptionsModule } from '../subscriptions';
import { AdminOverviewService } from './application/admin-overview.service';
import { AdminReviewService } from './application/admin-review.service';
import { BulkLearnersService } from './application/bulk-learners.service';
import { ExportsService } from './application/exports.service';
import {
  AdminBillingController,
  AdminContentController,
  AdminController,
  AdminExportsController,
} from './presentation/http/admin.controller';

/**
 * Admin console composition (PRD: ATUPA LMS Admin Platform). Owns no data;
 * it brings the other modules together for admin screens.
 */
@Module({
  imports: [
    IdentityModule,
    CatalogModule,
    LibraryModule,
    ClassesModule,
    ProgressModule,
    ReportsModule,
    SafetyModule,
    SchoolsModule,
    SubscriptionsModule,
    AuditModule,
  ],
  controllers: [
    AdminController,
    AdminContentController,
    AdminBillingController,
    AdminExportsController,
  ],
  providers: [
    AdminOverviewService,
    AdminReviewService,
    BulkLearnersService,
    ExportsService,
  ],
})
export class AdminModule {}
