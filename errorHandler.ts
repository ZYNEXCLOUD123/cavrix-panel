import { Request, Response, NextFunction } from 'express';
import { AppError, errorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const response: any = errorResponse(err.code, err.message);
    if ('errors' in (err as any)) {
      response.error.errors = (err as any).errors;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  logger.error(`Unhandled error: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(500).json(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.')
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    errorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found.`)
  );
}
