import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ContentStatus,
  ProficiencyLevel,
} from '../../../../shared/domain/enums';
import { CulturalCategory, GameType } from '../../domain/library.entities';

@Schema({ timestamps: true, collection: 'vocabulary' })
export class VocabularyRecord {
  @Prop({ required: true, lowercase: true, index: true })
  languageCode!: string;

  @Prop({ required: true, trim: true })
  term!: string;

  @Prop({ required: true, trim: true })
  meaning!: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  conceptKey!: string;

  @Prop()
  pronunciation?: string;

  @Prop()
  audioUrl?: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  exampleSentence?: string;

  @Prop()
  exampleTranslation?: string;

  @Prop({ index: true })
  category?: string;

  @Prop({ enum: ProficiencyLevel, type: String })
  level?: ProficiencyLevel;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.PUBLISHED,
    index: true,
  })
  status!: ContentStatus;
}
export const VocabularySchema = SchemaFactory.createForClass(VocabularyRecord);
VocabularySchema.index({ languageCode: 1, conceptKey: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'cultural_topics' })
export class CulturalTopicRecord {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, enum: CulturalCategory, type: String, index: true })
  category!: CulturalCategory;

  @Prop({ lowercase: true, index: true })
  languageCode?: string;

  @Prop()
  summary?: string;

  @Prop({ type: [Object], default: [] })
  blocks!: Array<{ type: string; content?: string; mediaUrl?: string }>;

  @Prop()
  quizId?: string;

  @Prop()
  ageGroup?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.DRAFT,
    index: true,
  })
  status!: ContentStatus;
}
export const CulturalTopicSchema =
  SchemaFactory.createForClass(CulturalTopicRecord);

@Schema({ timestamps: true, collection: 'games' })
export class GameRecord {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: GameType, type: String })
  gameType!: GameType;

  @Prop({ type: [String], default: [], index: true })
  languageCodes!: string[];

  @Prop()
  launchUrl?: string;

  @Prop()
  coverImageUrl?: string;

  @Prop({ type: [String], default: [] })
  conceptKeys!: string[];

  @Prop({ default: false })
  isPremium!: boolean;

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.DRAFT,
    index: true,
  })
  status!: ContentStatus;
}
export const GameSchema = SchemaFactory.createForClass(GameRecord);
