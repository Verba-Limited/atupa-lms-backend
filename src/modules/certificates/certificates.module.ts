import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../../config/app-config';
import { CatalogModule } from '../catalog';
import { IdentityModule } from '../identity';
import {
  CERTIFICATE_VERIFY_BASE_URL,
  CertificatesService,
} from './application/certificates.service';
import { CERTIFICATE_REPOSITORY } from './application/ports/certificate.ports';
import { CertificateMongoRepository } from './infrastructure/persistence/certificate.mongo-repository';
import {
  CertificateRecord,
  CertificateSchema,
} from './infrastructure/persistence/certificate.schema';
import { CertificatesListeners } from './presentation/events/certificates.listeners';
import { CertificatesController } from './presentation/http/certificates.controller';

@Module({
  imports: [
    IdentityModule,
    CatalogModule,
    MongooseModule.forFeature([
      { name: CertificateRecord.name, schema: CertificateSchema },
    ]),
  ],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CertificatesListeners,
    { provide: CERTIFICATE_REPOSITORY, useClass: CertificateMongoRepository },
    {
      provide: CERTIFICATE_VERIFY_BASE_URL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        `${config.frontendUrl}/certificates/verify`,
    },
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}
