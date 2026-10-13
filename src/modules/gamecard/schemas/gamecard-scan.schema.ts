import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GamecardScanDocument = HydratedDocument<GamecardScan>;

@Schema({ timestamps: true, collection: 'gamecard_scans' })
export class GamecardScan {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  qrPayload!: string;

  @Prop()
  languageCode?: string;

  @Prop()
  word?: string;

  @Prop()
  lessonId?: string;
}

export const GamecardScanSchema = SchemaFactory.createForClass(GamecardScan);
