import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserDeleted } from '../../../../shared/contracts/events';
import { ParentsService } from '../../application/parents.service';

@Injectable()
export class ParentsListeners {
  constructor(private readonly parents: ParentsService) {}

  @OnEvent(UserDeleted.NAME, { promisify: true })
  async onUserDeleted(event: UserDeleted) {
    await this.parents.removeAllLinksFor(event.userId);
  }
}
