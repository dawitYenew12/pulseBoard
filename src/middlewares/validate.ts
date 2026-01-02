import { Request, Response, NextFunction } from 'express';
import { z, ZodType } from 'zod';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

export const validate =
  (schema: Record<string, ZodType>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const object = Object.keys(schema).reduce(
      (obj, key) => {
        if (key === 'params' || key === 'query' || key === 'body') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          obj[key] = (req as any)[key];
        }
        return obj;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as Record<string, any>,
    );

    const checkSchema = z.object(schema);

    const { success, error, data } = checkSchema.safeParse(object);

    if (!success) {
      const errorMessage = error.issues
        .map((details) => details.message)
        .join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }

    Object.assign(req, data);

    return next();
  };
