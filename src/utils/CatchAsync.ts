import { Request, Response, NextFunction } from 'express';

type AsyncHandler = (
  _req: Request,
  _res: Response,
  _next: NextFunction,
) => Promise<void>;

export const catchAsync =
  (fn: AsyncHandler) =>
  (_req: Request, _res: Response, _next: NextFunction) => {
    Promise.resolve(fn(_req, _res, _next)).catch(_next);
  };
