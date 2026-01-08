import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/CatchAsync';
import pick from '../utils/pick';
import * as auditService from '../services/audit.service';

export const getLogs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['userId', 'action', 'search', 'entityId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // Handle date range filtering
  const { startDate, endDate } = req.query as any;
  if (startDate || endDate) {
    (filter as any).createdAt = {};
    if (startDate) {
      (filter as any).createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      (filter as any).createdAt.lte = new Date(endDate);
    }
  }

  const { logs, total } = await auditService.queryLogs(filter, options);
  res.status(httpStatus.OK).send({
    success: true,
    data: logs,
    total,
  });
});
