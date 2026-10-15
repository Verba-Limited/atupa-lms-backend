import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { Certificate } from '../../domain/certificate.entity';

export const CERTIFICATE_REPOSITORY = Symbol('CERTIFICATE_REPOSITORY');

export interface CertificateRepository {
  create(input: Omit<Certificate, 'id'>): Promise<Certificate>;
  findById(id: string): Promise<Certificate | null>;
  findByUserAndCourse(
    userId: string,
    courseId: string,
  ): Promise<Certificate | null>;
  findByVerificationCode(code: string): Promise<Certificate | null>;
  listByUsers(userIds: string[]): Promise<Certificate[]>;
  list(
    filter: { courseId?: string; status?: Certificate['status'] },
    page: PageRequest,
  ): Promise<Page<Certificate>>;
  update(id: string, patch: Partial<Certificate>): Promise<Certificate | null>;
  count(filter: { since?: Date; userIds?: string[] }): Promise<number>;
}
