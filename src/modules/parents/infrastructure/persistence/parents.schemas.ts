import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'parent_links' })
export class ParentLinkRecord {
  @Prop({ required: true, index: true }) parentId!: string;
  @Prop({ required: true, index: true }) childId!: string;
}
export const ParentLinkSchema = SchemaFactory.createForClass(ParentLinkRecord);
ParentLinkSchema.index({ parentId: 1, childId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'parent_link_codes' })
export class LinkCodeRecord {
  @Prop({ required: true, index: true }) learnerId!: string;
  @Prop({ required: true, unique: true }) codeHash!: string;
  @Prop({ required: true, expires: 0 }) expiresAt!: Date;
  @Prop({ type: Date, default: null }) usedAt?: Date | null;
}
export const LinkCodeSchema = SchemaFactory.createForClass(LinkCodeRecord);
