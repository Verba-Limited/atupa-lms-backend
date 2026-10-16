import { Module } from '@nestjs/common';
import * as os from 'os';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from './config/app-config';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { AssignmentsModule } from './modules/assignments';
import { CatalogModule } from './modules/catalog';
import { CertificatesModule } from './modules/certificates';
import { ClassesModule } from './modules/classes';
import { GamecardModule } from './modules/gamecard';
import { IdentityModule } from './modules/identity';
import { LearningModule } from './modules/learning';
import { LibraryModule } from './modules/library';
import { MediaModule } from './modules/media';
import { NotificationsModule } from './modules/notifications';
import { ParentsModule } from './modules/parents';
import { ProgressModule } from './modules/progress';
import { ReportsModule } from './modules/reports';
import { SchoolsModule } from './modules/schools';
import { SearchModule } from './modules/search';
import { SubscriptionsModule } from './modules/subscriptions';
import { SeedModule } from './seed/seed.module';
import { SharedModule } from './shared/shared.module';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { JwtAuthGuard } from './shared/presentation/guards/jwt-auth.guard';
import { RolesGuard } from './shared/presentation/guards/roles.guard';

/**
 * Modular monolith: each bounded context is a Nest module with hexagonal
 * layers (domain / application / infrastructure / presentation). Modules
 * talk through exported application facades and integration events.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SharedModule,
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/atupa_lms',
        // The driver loads `os` via dynamic import(), which fails in CommonJS
        // sandboxes (e.g. Jest) and silently breaks the handshake metadata.
        runtimeAdapters: { os },
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),

    IdentityModule,
    CatalogModule,
    LibraryModule,
    MediaModule,
    SubscriptionsModule,
    LearningModule,
    ProgressModule,
    CertificatesModule,
    GamecardModule,
    ParentsModule,
    SchoolsModule,
    ClassesModule,
    AssignmentsModule,
    NotificationsModule,
    SearchModule,
    ReportsModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
