import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'schools' })
export class SchoolRecord {
  @Prop({ required: true, unique: true, trim: true }) name!: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop() phone?: string;
  @Prop() address?: string;
  @Prop() region?: string;
  @Prop() declaredStudentCount?: number;
  @Prop() adminUserId?: string;
  @Prop({ required: true, unique: true, uppercase: true }) joinCode!: string;
  @Prop({
    type: {
      leaderboardsEnabled: { type: Boolean, default: true },
      showLearnerNamesOnLeaderboards: { type: Boolean, default: false },
      _id: false,
    },
    default: {},
  })
  settings!: {
    leaderboardsEnabled: boolean;
    showLearnerNamesOnLeaderboards: boolean;
  };
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ type: MongooseSchema.Types.Mixed })
  verification?: Record<string, unknown>;
}
export const SchoolSchema = SchemaFactory.createForClass(SchoolRecord);
