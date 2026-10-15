import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { CertificateIssued } from '../../../shared/contracts/events';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { PageRequest } from '../../../shared/domain/pagination';
import { displayName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService } from '../../catalog';
import { UsersService } from '../../identity';
import {
  Certificate,
  newCertificateNumber,
  newVerificationCode,
} from '../domain/certificate.entity';
import type { QrCodeGenerator } from '../../../shared/application/qr-code.port';
import { QR_CODE_GENERATOR } from '../../../shared/application/qr-code.port';
import type { CertificateRepository } from './ports/certificate.ports';
import { CERTIFICATE_REPOSITORY } from './ports/certificate.ports';

export const CERTIFICATE_VERIFY_BASE_URL = Symbol(
  'CERTIFICATE_VERIFY_BASE_URL',
);

export interface CertificateView extends Certificate {
  verificationUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(QR_CODE_GENERATOR) private readonly qr: QrCodeGenerator,
    @Inject(CERTIFICATE_VERIFY_BASE_URL) private readonly verifyBaseUrl: string,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly users: UsersService,
    private readonly catalog: CatalogQueryService,
  ) {}

  /** Issued by the system when a learner completes a course (idempotent). */
  async issueForCompletedCourse(
    userId: string,
    courseId: string,
  ): Promise<Certificate> {
    const existing = await this.certificates.findByUserAndCourse(
      userId,
      courseId,
    );
    if (existing) return existing;

    const [user, course] = await Promise.all([
      this.users.getById(userId),
      this.catalog.findCourse(courseId),
    ]);
    if (!course) throw new NotFoundError('Course not found');
    const language = await this.catalog.findLanguage(course.languageCode);

    const certificate = await this.certificates.create({
      certificateId: newCertificateNumber(),
      verificationCode: newVerificationCode(),
      userId,
      learnerName: displayName(user),
      courseId,
      courseTitle: course.title,
      languageCode: course.languageCode,
      languageName: language?.name ?? course.languageCode,
      level: course.level,
      completedAt: new Date(),
      status: 'valid',
    });
    this.logger.log(
      `Issued ${certificate.certificateId} to ${userId} for ${courseId}`,
    );
    await this.events.publish(
      new CertificateIssued(
        userId,
        certificate.id,
        courseId,
        course.title,
        certificate.verificationCode,
      ),
    );
    return certificate;
  }

  async listMine(actor: Actor): Promise<CertificateView[]> {
    const certificates = await this.certificates.listByUsers([actor.userId]);
    return Promise.all(certificates.map((c) => this.toView(c)));
  }

  listForUsers(userIds: string[]): Promise<Certificate[]> {
    return this.certificates.listByUsers(userIds);
  }

  countIssued(filter: { since?: Date; userIds?: string[] } = {}) {
    return this.certificates.count(filter);
  }

  /** Owner or admins; other viewers (parents, teachers) go through reports. */
  async getForActor(actor: Actor, id: string): Promise<CertificateView> {
    const certificate = await this.certificates.findById(id);
    if (!certificate) throw new NotFoundError('Certificate not found');
    if (
      certificate.userId !== actor.userId &&
      actor.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError('You cannot view this certificate');
    }
    return this.toView(certificate);
  }

  /** Public verification: only what is printed on the certificate. */
  async verify(code: string) {
    const certificate = await this.certificates.findByVerificationCode(
      code.trim().toUpperCase(),
    );
    if (!certificate)
      throw new NotFoundError('No certificate matches this code');
    return {
      valid: certificate.status === 'valid',
      status: certificate.status,
      certificateId: certificate.certificateId,
      learnerName: certificate.learnerName,
      courseTitle: certificate.courseTitle,
      language: certificate.languageName,
      level: certificate.level,
      completedAt: certificate.completedAt,
    };
  }

  list(
    filter: { courseId?: string; status?: Certificate['status'] },
    page: PageRequest,
  ) {
    return this.certificates.list(filter, page);
  }

  async revoke(id: string, reason: string): Promise<Certificate> {
    const updated = await this.certificates.update(id, {
      status: 'revoked',
      revokedReason: reason,
    });
    if (!updated) throw new NotFoundError('Certificate not found');
    return updated;
  }

  private async toView(certificate: Certificate): Promise<CertificateView> {
    const verificationUrl = `${this.verifyBaseUrl}/${certificate.verificationCode}`;
    return {
      ...certificate,
      verificationUrl,
      qrCodeDataUrl: await this.qr.toDataUrl(verificationUrl),
    };
  }
}
