import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health/health.controller';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ClassesModule } from './modules/classes/classes.module';
import { GamecardModule } from './modules/gamecard/gamecard.module';
import { LearningModule } from './modules/learning/learning.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { SearchModule } from './modules/search/search.module';
import { SeedModule } from './modules/seed/seed.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGODB_URI') ??
          'mongodb://127.0.0.1:27017/atupa_lms',
      }),
    }),
    UsersModule,
    AuthModule,
    CatalogModule,
    LearningModule,
    ProgressModule,
    ClassesModule,
    AssignmentsModule,
    ParentsModule,
    SchoolsModule,
    SearchModule,
    ReportsModule,
    CertificatesModule,
    GamecardModule,
    NotificationsModule,
    SubscriptionsModule,
    MediaModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
