import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { catchAsync } from '../utils/CatchAsync';
import * as dashboardService from '../services/dashboard.service';

export const getStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await dashboardService.getDashboardStats(
    req.user!.id,
    req.user!.role,
  );
  res.status(httpStatus.OK).send(stats);
});
