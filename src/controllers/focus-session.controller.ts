import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { catchAsync } from '../utils/CatchAsync';
import * as focusSessionService from '../services/focus-session.service';

import * as auditService from '../services/audit.service';

export const startSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const session = await focusSessionService.startSession(
    user.id,
    user.role,
    req.body,
  );

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'CREATE',
    entity: 'FocusSession',
    actionReceiver: `Session for Task ID: ${session.taskId || 'None'}`,
    description: `Focus session started by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

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

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE', // or COMPLETED
    entity: 'FocusSession',
    actionReceiver: `Session ID: ${session.id}`,
    description: `Focus session stopped by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

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

export const getTaskSessions = catchAsync(
  async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const sessions = await focusSessionService.getSessionsByTaskId(taskId);
    res.status(httpStatus.OK).json({
      message: 'Task sessions retrieved successfully',
      sessions,
    });
  },
);
