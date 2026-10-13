import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Certificate, CertificateDocument } from './schemas/certificate.schema';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectModel(Certificate.name)
    private readonly certificateModel: Model<Certificate>,
  ) {}

  issue(input: {
    userId: string;
    learnerName: string;
    courseId: string;
    courseTitle: string;
    languageCode: string;
  }) {
    const certificateId = `ATUPA-${randomUUID().slice(0, 8).toUpperCase()}`;
    const verificationCode = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return this.certificateModel.create({
      certificateId,
      verificationCode,
      userId: input.userId,
      learnerName: input.learnerName,
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      languageCode: input.languageCode,
      completedAt: new Date(),
    });
  }

  verify(verificationCode: string): Promise<CertificateDocument> {
    return this.certificateModel
      .findOne({ verificationCode: verificationCode.toUpperCase() })
      .exec()
      .then((doc) => {
        if (!doc) throw new NotFoundException('Certificate not found');
        return doc;
      });
  }

  listForUser(userId: string): Promise<CertificateDocument[]> {
    return this.certificateModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }
}
