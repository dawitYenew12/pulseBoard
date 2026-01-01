import config from '../config/config';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';

export const errorConverter = (
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode =
      error instanceof mongoose.Error
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || (httpStatus[statusCode] as string);
    error = new ApiError(statusCode, message, false, error.stack);
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

  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[statusCode as keyof typeof httpStatus] as string;
  }

  const response = {
    error: true,
    code: statusCode,
    message: message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  res.locals.errorMessage = message;

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).json(response);
};
