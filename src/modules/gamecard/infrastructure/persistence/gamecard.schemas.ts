import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'gamecards' })
export class GameCardRecord {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;
  @Prop({ required: true, lowercase: true, index: true }) conceptKey!: string;
  @Prop({ required: true, lowercase: true, index: true }) languageCode!: string;
  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop() imageUrl?: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) challenge?: unknown;
  @Prop({ default: true }) isActive!: boolean;
}
export const GameCardSchema = SchemaFactory.createForClass(GameCardRecord);

@Schema({ collection: 'gamecard_plays' })
export class PlayRecordRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true, enum: ['scan', 'challenge', 'game'], type: String })
  kind!: string;
  @Prop({ required: true }) ref!: string;
  @Prop() languageCode?: string;
  @Prop() correct?: boolean;
  @Prop() scorePercent?: number;
  @Prop() durationSeconds?: number;
  @Prop({ default: false }) rewarded!: boolean;
  @Prop({ required: true }) day!: string;
  @Prop({ required: true }) at!: Date;
}
export const PlayRecordSchema = SchemaFactory.createForClass(PlayRecordRecord);
PlayRecordSchema.index({ userId: 1, at: -1 });
PlayRecordSchema.index({ at: -1, kind: 1 });
// At most one rewarded play per user, kind, card/game and day.
PlayRecordSchema.index(
  { userId: 1, kind: 1, ref: 1, day: 1 },
  { unique: true, partialFilterExpression: { rewarded: true } },
);
