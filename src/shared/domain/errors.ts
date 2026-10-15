/**
 * Domain/application errors. They carry no HTTP knowledge; the presentation
 * layer maps them to status codes (see DomainExceptionFilter).
 */
export abstract class DomainError extends Error {
  abstract readonly kind:
    | 'not_found'
    | 'forbidden'
    | 'conflict'
    | 'validation'
    | 'unauthorized'
    | 'unavailable'
    | 'payment_required';

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found';
}

export class ForbiddenError extends DomainError {
  readonly kind = 'forbidden';
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict';
}

export class ValidationError extends DomainError {
  readonly kind = 'validation';
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'unauthorized';
}

export class ServiceUnavailableError extends DomainError {
  readonly kind = 'unavailable';
}

export class PaymentRequiredError extends DomainError {
  readonly kind = 'payment_required';
}
