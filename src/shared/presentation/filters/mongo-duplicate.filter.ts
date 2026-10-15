import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { mongo } from 'mongoose';

type MongoServerError = InstanceType<typeof mongo.MongoServerError>;

/** Unique index violations become 409 Conflict instead of 500. */
@Catch(mongo.MongoServerError)
export class MongoDuplicateKeyFilter implements ExceptionFilter {
  catch(exception: MongoServerError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception.code === 11000) {
      const field = Object.keys(exception.keyValue ?? {})[0] ?? 'value';
      response.status(HttpStatus.CONFLICT).json({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        message: `A record with this ${field} already exists`,
      });
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
