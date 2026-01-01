import config from '../config/config';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorConverter = (
  err: any,
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode: number;
    let message: string;
    let isOperational = true;

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': // Unique constraint violation
          statusCode = httpStatus.CONFLICT; // Better than 400 for duplicates
          message = 'A record with this value already exists.';
          break;

        case 'P2003': // Foreign key constraint violation
          statusCode = httpStatus.BAD_REQUEST;
          message = 'Invalid reference to related record.';
          break;

        case 'P2025': // Record not found
          statusCode = httpStatus.NOT_FOUND;
          message = 'The requested record was not found.';
          break;

        default:
          statusCode = httpStatus.BAD_REQUEST;
          message = 'Invalid request.';
          isOperational = false; // Unknown Prisma code → treat as unexpected
      }
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid query or input data.';
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message =
        error.message ||
        (httpStatus[
          `${statusCode}_MESSAGE` as keyof typeof httpStatus
        ] as string);
      isOperational = false;
    }

    error = new ApiError(statusCode, message, isOperational, err.stack);
  }

  next(error);
};

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let { statusCode, message } = err;

  // In production, force generic message for non-operational (unexpected) errors
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  const response = {
    error: true,
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  res.locals.errorMessage = message;

  // Always log full error (especially in prod for unexpected ones)
  logger.error(err);

  res.status(statusCode).json(response);
};
