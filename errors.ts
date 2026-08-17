export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} could not be found.`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  public errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', 'Validation failed.');
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export function successResponse(data: any = null, message?: string) {
  const response: any = { success: true };
  if (data !== null) response.data = data;
  if (message) response.message = message;
  return response;
}

export function errorResponse(code: string, message: string, errors?: Record<string, string>) {
  const response: any = { success: false, error: { code, message } };
  if (errors) response.error.errors = errors;
  return response;
}
