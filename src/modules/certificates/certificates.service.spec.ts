import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { CertificatesService } from './certificates.service';
import { Certificate } from './schemas/certificate.schema';

describe('CertificatesService', () => {
  const model = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  } as unknown as Model<Certificate>;

  const service = new CertificatesService(model);

  it('issues certificate with verification code', async () => {
    model.create = jest.fn().mockResolvedValue({
      certificateId: 'ATUPA-ABC',
      verificationCode: 'XYZ',
    });
    const cert = await service.issue({
      userId: 'u1',
      learnerName: 'Ada',
      courseId: 'c1',
      courseTitle: 'Yoruba Beginner',
      languageCode: 'yoruba',
    });
    expect(cert.verificationCode).toBeDefined();
  });

  it('throws when verification fails', async () => {
    model.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(service.verify('MISSING')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
