import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { DomainError } from '../../domain/errors';

const STATUS_BY_KIND: Record<DomainError['kind'], number> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  conflict: HttpStatus.CONFLICT,
  validation: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  payment_required: HttpStatus.PAYMENT_REQUIRED,
};

/** Maps domain errors and persistence errors to clean HTTP responses. */
@Catch(DomainError, MongooseError.CastError, MongooseError.ValidationError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status: number = HttpStatus.BAD_REQUEST;
    let message = exception.message;

    if (exception instanceof DomainError) {
      status = STATUS_BY_KIND[exception.kind];
    } else if (exception instanceof MongooseError.CastError) {
      message = `Invalid value for ${exception.path}`;
    } else {
      this.logger.warn(exception.message);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }
}
