import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
}
export const SchoolSchema = SchemaFactory.createForClass(SchoolRecord);
