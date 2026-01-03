import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import config from '../config/config';

// Helper function to get client IP
const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Interface for defining how to extract the unique identifier (email, token, etc.)
 * from the request for a specific route.
 */
interface LimiterOptions {
  prefix: string; // e.g., 'login', 'signup'
  identifierGetter: (req: Request) => string; // Function to extract email/token
  errorMessage: string; // Custom error message prefix
}

/**
 * Factory function to create a 3-layer composite rate limiter:
 * 1. IP Daily Limit (Global per IP for this action)
 * 2. Identifier Limit (e.g., max fails per email)
 * 3. Combined IP + Identifier Limit
 */
const createCompositeLimiter = ({
  prefix,
  identifierGetter,
  errorMessage,
}: LimiterOptions) => {
  // 1. Rate limiter by IP (daily limit)
  const ipDailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: config.rateLimit.ipMaxAttemptsPerDay,
    keyGenerator: (req) => `${prefix}_ip_daily_${getClientIP(req)}`,
    handler: (_req, _res, next) => {
      next(
        new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          `Too many ${errorMessage} attempts from this IP. Please try again after 24 hours.`,
        ),
      );
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all attempts for broad IP protection
  });

  // 2. Rate limiter by Identifier (10 minutes window)
  const identifierLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: config.rateLimit.emailMaxFails,
    keyGenerator: (req) => `${prefix}_id_${identifierGetter(req) || 'unknown'}`,
    handler: (_req, _res, next) => {
      next(
        new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          `Too many ${errorMessage} failures for this account. Please try again in 10 minutes.`,
        ),
      );
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
  });

  // 3. Rate limiter by Identifier + IP combination (10 minutes window)
  const identifierIPLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: config.rateLimit.emailIpMaxFails,
    keyGenerator: (req) =>
      `${prefix}_id_ip_${identifierGetter(req) || 'unknown'}_${getClientIP(req)}`,
    handler: (_req, _res, next) => {
      next(
        new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          `Too many ${errorMessage} attempts. Please try again in 10 minutes.`,
        ),
      );
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
  });

  // Return the middleware function that executes them sequentially
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          ipDailyLimiter(req, res, (err) => (err ? reject(err) : resolve()));
        }),
        new Promise<void>((resolve, reject) => {
          identifierLimiter(req, res, (err) => (err ? reject(err) : resolve()));
        }),
        new Promise<void>((resolve, reject) => {
          identifierIPLimiter(req, res, (err) =>
            err ? reject(err) : resolve(),
          );
        }),
      ]);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// =============================================================================
// EXPORTED LIMITERS
// =============================================================================

export const loginRateLimiter = createCompositeLimiter({
  prefix: 'login',
  identifierGetter: (req) => req.body.email,
  errorMessage: 'login',
});

export const signupRateLimiter = createCompositeLimiter({
  prefix: 'signup',
  identifierGetter: (req) => req.body.email,
  errorMessage: 'signup',
});

export const forgotPasswordLimiter = createCompositeLimiter({
  prefix: 'forgot_pass',
  identifierGetter: (req) => req.body.email,
  errorMessage: 'password reset request',
});

export const resetPasswordLimiter = createCompositeLimiter({
  prefix: 'reset_pass',
  identifierGetter: (req) => req.body.token, // Use token as identifier
  errorMessage: 'password reset',
});

export const verifyEmailLimiter = createCompositeLimiter({
  prefix: 'verify_email',
  identifierGetter: (req) =>
    (req.query.token as string) || req.body.token || 'unknown',
  errorMessage: 'verification',
});
