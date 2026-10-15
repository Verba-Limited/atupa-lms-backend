import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Builds every model's indexes before the app serves traffic. Several rules
 * (points awarded once, one certificate per course, one submission per
 * learner...) rely on unique indexes; Mongoose's background autoIndex could
 * otherwise lose a race on a fresh database.
 */
@Injectable()
export class MongoIndexesInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(MongoIndexesInitializer.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const model of Object.values(this.connection.models)) {
      try {
        await model.createIndexes();
      } catch (error) {
        this.logger.error(
          `Index build failed for ${model.collection.collectionName}: ${(error as Error).message}`,
        );
      }
    }
  }
}
