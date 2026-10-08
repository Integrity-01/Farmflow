import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

interface ErrorPayload {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  let statusCode = 500;
  let payload: ErrorPayload = {
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  };

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    payload = {
      status: 'error',
      code: error.code,
      message: error.message,
    };
  } else if (error instanceof ZodError) {
    statusCode = 400;
    payload = {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Please correct the highlighted fields.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  } else if (error instanceof SyntaxError) {
    statusCode = 400;
    payload = {
      status: 'error',
      code: 'INVALID_JSON',
      message: 'The request body is not valid JSON.',
    };
  } else {
    logger.error('Unhandled error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json(payload);
}