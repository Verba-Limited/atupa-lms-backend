import {
  BadRequestException,
  Injectable,
  Optional,
  PipeTransform,
} from '@nestjs/common';
import { isObjectId } from '../../infrastructure/mongo/mongo-mapper';

/** Rejects malformed ids with 400 before they reach a use case. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<
  string | undefined,
  string | undefined
> {
  constructor(
    @Optional() private readonly options: { optional?: boolean } = {},
  ) {}

  transform(value: string | undefined): string | undefined {
    if (value === undefined && this.options.optional) return undefined;
    if (!isObjectId(value)) {
      throw new BadRequestException(`Invalid id: ${value}`);
    }
    return value;
  }
}
