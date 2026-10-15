import { randomCode } from '../../../shared/domain/random-code';

export interface Certificate {
  id: string;
  /** Human-facing id printed on the certificate, e.g. ATUPA-7K2M9QXD. */
  certificateId: string;
  /** Public code used to verify authenticity. */
  verificationCode: string;
  userId: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  languageCode: string;
  languageName: string;
  level: string;
  completedAt: Date;
  status: 'valid' | 'revoked';
  revokedReason?: string;
  createdAt?: Date;
}

export function newCertificateNumber(): string {
  return `ATUPA-${randomCode(8)}`;
}

export function newVerificationCode(): string {
  return randomCode(12);
}
