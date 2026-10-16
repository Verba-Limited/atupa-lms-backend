import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  SchoolMemberRemoved,
  UserDeleted,
} from '../../../../shared/contracts/events';
import { ClassesService } from '../../application/classes.service';

@Injectable()
export class ClassesListeners {
  constructor(private readonly classes: ClassesService) {}

  @OnEvent(SchoolMemberRemoved.NAME, { promisify: true })
  async onSchoolMemberRemoved(event: SchoolMemberRemoved) {
    await this.classes.removeUserFromSchoolClasses(
      event.schoolId,
      event.userId,
    );
  }

  @OnEvent(UserDeleted.NAME, { promisify: true })
  async onUserDeleted(event: UserDeleted) {
    await this.classes.removeStudentEverywhere(event.userId);
  }
}
