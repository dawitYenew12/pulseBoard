import rateLimit from 'express-rate-limit';
import httpStatus from 'http-status';
import config from '../config/config';
import ApiError from '../utils/ApiError';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        'Too many requests, please try again later.',
      ),
    );
  },
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
});
