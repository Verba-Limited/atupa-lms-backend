import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { AlertRaised } from '../../../shared/contracts/events';
import { NotFoundError } from '../../../shared/domain/errors';
import { PageRequest } from '../../../shared/domain/pagination';
import { Alert, AlertStatus } from '../domain/alert.entity';
import type {
  AlertFilter,
  AlertRepository,
} from './ports/safety.repositories.port';
import { ALERT_REPOSITORY } from './ports/safety.repositories.port';

/** Unusual activity flagged for admins (M-29). */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(ALERT_REPOSITORY) private readonly alerts: AlertRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** Admins are emailed only when an alert is new, not on every repeat. */
  async raise(
    input: Omit<Alert, 'id' | 'status' | 'occurrences' | 'lastSeenAt'>,
  ): Promise<Alert> {
    const { alert, created } = await this.alerts.raise(input);
    if (created) {
      await this.events.publish(
        new AlertRaised(alert.id, alert.type, alert.severity, alert.summary),
      );
    }
    return alert;
  }

  list(filter: AlertFilter, page: PageRequest) {
    return this.alerts.list(filter, page);
  }

  count(filter: AlertFilter) {
    return this.alerts.count(filter);
  }

  async update(
    actor: Actor,
    id: string,
    patch: { status: AlertStatus; note?: string },
  ) {
    const alert = await this.alerts.update(id, {
      status: patch.status,
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      handledByUserId: actor.userId,
    });
    if (!alert) throw new NotFoundError('Alert not found');
    return alert;
  }
}
