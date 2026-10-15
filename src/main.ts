import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.set('trust proxy', 1);
  // Local media fallback (development only; production uses Cloudinary).
  app.useStaticAssets(resolve(config.mediaUploadDir), { prefix: '/uploads/' });
}

async function bootstrap() {
  // rawBody is needed to verify Paystack webhook signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);

  const docs = new DocumentBuilder()
    .setTitle('ATUPA LMS API')
    .setDescription(
      'Nigerian languages & culture LMS (Yoruba, Igbo, Hausa). Modular monolith with hexagonal modules.',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, docs));

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`ATUPA LMS listening on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

if (require.main === module) {
  void bootstrap();
}
