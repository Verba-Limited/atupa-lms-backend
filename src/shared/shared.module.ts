import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { EVENT_BUS } from './application/event-bus.port';
import { QR_CODE_GENERATOR } from './application/qr-code.port';
import { EventEmitterEventBus } from './infrastructure/events/event-emitter.event-bus';
import { MongoIndexesInitializer } from './infrastructure/mongo/mongo-indexes.initializer';
import { QrCodePngGenerator } from './infrastructure/qr/qrcode.generator';

/** Cross-cutting kernel available to every module. */
@Global()
@Module({
  providers: [
    AppConfig,
    MongoIndexesInitializer,
    { provide: EVENT_BUS, useClass: EventEmitterEventBus },
    { provide: QR_CODE_GENERATOR, useClass: QrCodePngGenerator },
  ],
  exports: [AppConfig, EVENT_BUS, QR_CODE_GENERATOR],
})
export class SharedModule {}
