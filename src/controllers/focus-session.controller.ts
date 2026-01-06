import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { catchAsync } from '../utils/CatchAsync';
import * as focusSessionService from '../services/focus-session.service';

export const startSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const session = await focusSessionService.startSession(
    user.id,
    user.role,
    req.body,
  );
  res.status(httpStatus.CREATED).json({
    message: 'Focus session started successfully',
    session,
  });
});

export const stopSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const session = await focusSessionService.stopSession(
    req.params.sessionId,
    user.id,
  );
  res.status(httpStatus.OK).json({
    message: 'Focus session stopped successfully',
    session,
  });
});

export const getActiveSession = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const session = await focusSessionService.getActiveSession(user.id);
    if (!session) {
      res.status(httpStatus.NO_CONTENT).send();
    } else {
      res.status(httpStatus.OK).json({
        message: 'Active focus session retrieved successfully',
        session,
      });
    }
  },
);

export const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const requester = req.user as any;
  let userId = requester.id;

  // Allow admins and PMs to view other users' analytics
  if (
    req.query.userId &&
    (requester.role === 'SUPERADMIN' || requester.role === 'PM')
  ) {
    userId = req.query.userId as string;
  }

  const taskId = req.query.taskId as string | undefined;
  const stats = await focusSessionService.getAnalytics(userId, taskId);
  res.status(httpStatus.OK).json({
    message: 'Focus session analytics retrieved successfully',
    stats,
  });
});
