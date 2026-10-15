import { Param } from '@nestjs/common';
import { ParseObjectIdPipe } from '../pipes/parse-object-id.pipe';

/** `@IdParam('courseId')` = route param validated as a Mongo ObjectId. */
export const IdParam = (name: string) => Param(name, new ParseObjectIdPipe());
