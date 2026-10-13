import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LanguageDocument = HydratedDocument<Language>;

@Schema({ timestamps: true, collection: 'languages' })
export class Language {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const LanguageSchema = SchemaFactory.createForClass(Language);
