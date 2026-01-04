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
  res.status(httpStatus.CREATED).send(session);
});

export const stopSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const session = await focusSessionService.stopSession(
    req.params.sessionId,
    user.id,
  );
  res.send(session);
});

export const getActiveSession = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const session = await focusSessionService.getActiveSession(user.id);
    if (!session) {
      res.status(httpStatus.NO_CONTENT).send();
    } else {
      res.send(session);
    }
  },
);

export const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const taskId = req.query.taskId as string | undefined;
  const stats = await focusSessionService.getAnalytics(user.id, taskId);
  res.send(stats);
});
