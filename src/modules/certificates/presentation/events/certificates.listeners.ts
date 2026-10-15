import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CourseCompleted } from '../../../../shared/contracts/events';
import { CertificatesService } from '../../application/certificates.service';

@Injectable()
export class CertificatesListeners {
  constructor(private readonly certificates: CertificatesService) {}

  @OnEvent(CourseCompleted.NAME, { promisify: true })
  async onCourseCompleted(event: CourseCompleted) {
    await this.certificates.issueForCompletedCourse(
      event.userId,
      event.courseId,
    );
  }
}
