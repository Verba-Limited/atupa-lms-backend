import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';
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

/** Every error response has this shape. */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  /** Field-level details, e.g. each failed validation rule. */
  errors?: string[];
  path: string;
  timestamp: string;
}

interface Mapped {
  status: number;
  message: string;
  errors?: string[];
}

/**
 * Single error formatter for the whole API: domain errors, Nest HTTP
 * exceptions (auth, validation, 404, rate limit), persistence errors and
 * unexpected crashes all produce the same `ApiErrorResponse`.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { status, message, errors } = this.map(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode: status,
      message,
      ...(errors?.length ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private map(exception: unknown): Mapped {
    if (exception instanceof DomainError) {
      return {
        status: STATUS_BY_KIND[exception.kind],
        message: exception.message,
      };
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid value for ${exception.path}`,
      };
    }
    if (exception instanceof MongooseError.ValidationError) {
      const errors = Object.values(exception.errors).map((e) => e.message);
      return {
        status: HttpStatus.BAD_REQUEST,
        message: errors[0] ?? 'Validation failed',
        errors,
      };
    }
    if (
      exception instanceof mongo.MongoServerError &&
      exception.code === 11000
    ) {
      const field =
        Object.keys((exception.keyValue as Record<string, unknown>) ?? {})[0] ??
        'value';
      return {
        status: HttpStatus.CONFLICT,
        message: `A record with this ${field} already exists`,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): Mapped {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') return { status, message: payload };
    const raw = (payload as { message?: unknown }).message;
    if (Array.isArray(raw)) {
      const errors = raw.map(String);
      return { status, message: errors[0] ?? exception.message, errors };
    }
    if (status === 429) {
      return { status, message: 'Too many requests, please slow down' };
    }
    return {
      status,
      message: typeof raw === 'string' ? raw : exception.message,
    };
  }
}
