export class ScaleMapError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScaleMapError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends ScaleMapError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ScaleMapError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ScaleMapError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', 401, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ScaleMapError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', 403, details);
    this.name = 'ForbiddenError';
  }
}

export const isScaleMapError = (error: unknown): error is ScaleMapError => {
  return error instanceof ScaleMapError;
};