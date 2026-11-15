import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserRole } from '../../../../shared/domain/user-role';
import {
  VerificationDocument,
  VerificationStatus,
} from '../../domain/user.entity';

@Schema({ timestamps: true, collection: 'users' })
export class UserRecord {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, enum: UserRole, type: String, index: true })
  role!: UserRole;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ lowercase: true, trim: true, index: true })
  preferredLanguageCode?: string;

  @Prop()
  profileImageUrl?: string;

  @Prop()
  teachingExperienceYears?: number;

  @Prop({ type: [String], default: [] })
  languageSpecializations!: string[];

  @Prop({ type: String, default: null, index: true })
  schoolId?: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: String, default: null })
  refreshTokenHash?: string | null;

  @Prop({ type: String, default: null, index: { sparse: true } })
  passwordResetTokenHash?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt?: Date | null;

  @Prop({ index: true })
  lastActiveAt?: Date;

  @Prop({ type: Date, default: null })
  lastLoginAt?: Date | null;

  @Prop({ enum: VerificationStatus, type: String, index: true })
  verificationStatus?: VerificationStatus;

  @Prop({
    type: [{ mediaId: String, url: String, label: String, _id: false }],
    default: undefined,
  })
  verificationDocuments?: VerificationDocument[];

  @Prop({ type: String, default: null })
  verificationNote?: string | null;

  @Prop({ type: Date, default: null })
  verificationSubmittedAt?: Date | null;

  @Prop({ type: Date, default: null })
  verifiedAt?: Date | null;

  @Prop({ type: String, default: null })
  verifiedByUserId?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(UserRecord);
UserSchema.index({ schoolId: 1, role: 1 });
