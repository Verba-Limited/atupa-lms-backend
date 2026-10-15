import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBus } from '../../application/event-bus.port';
import { IntegrationEvent } from '../../contracts/events';

/**
 * In-process event bus adapter. Listeners run asynchronously and their
 * failures are logged rather than failing the publishing use case.
 * Swap for a queue-backed adapter if modules are ever split into services.
 */
@Injectable()
export class EventEmitterEventBus implements EventBus {
  private readonly logger = new Logger(EventEmitterEventBus.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: IntegrationEvent): Promise<void> {
    try {
      await this.emitter.emitAsync(event.name, event);
    } catch (error) {
      this.logger.error(
        `Listener failed for ${event.name}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
