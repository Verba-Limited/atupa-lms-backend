import { IntegrationEvent } from '../contracts/events';

export const EVENT_BUS = Symbol('EVENT_BUS');

/** Outbound port for publishing integration events between modules. */
export interface EventBus {
  publish(event: IntegrationEvent): Promise<void>;
}
