import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as taskService from '../services/task.service';
import * as projectService from '../services/project.service';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import * as auditService from '../services/audit.service';

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.createTask(req.body, user.id);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'CREATE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task created by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });

  res.status(httpStatus.CREATED).json({
    message: 'Task created successfully',
    task,
  });
});

import { prisma } from '../config/prisma';

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, [
    'projectId',
    'assignedTo',
    'status',
    'priority',
  ]);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const user = req.user as any;

  if (req.query.projectId) {
    const canAccess = await projectService.canUserAccessProject(
      req.query.projectId as string,
      user.id,
      user.role,
    );
    if (!canAccess) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Cannot access tasks for this project',
      );
    }
  } else if (user.role !== Role.SUPERADMIN) {
    // If no specific project requested, and not SUPERADMIN, return tasks from ALL projects user is part of
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { pmId: user.id },
          { projectMembers: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });

    const projectIds = userProjects.map((p) => p.id);

    // Add to filter
    (filter as any).projectId = { in: projectIds };
  }

  const { result, total, page, limit } = await taskService.queryTasks(
    filter,
    options,
  );
  res.status(httpStatus.OK).json({
    message: 'Tasks retrieved successfully',
    result,
    total,
    page,
    limit,
  });
});

export const getTask = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.getTaskById(req.params.taskId);
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  const canAccess = await projectService.canUserAccessProject(
    task.projectId,
    (req.user as any).id,
    (req.user as any).role,
  );
  if (!canAccess) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cannot access this task');
  }

  res.status(httpStatus.OK).json({
    message: 'Task retrieved successfully',
    task,
  });
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.updateTaskById(
    req.params.taskId,
    req.body,
    user.id,
    user.role as Role,
  );

  // Manual Audit Log for precise details (e.g. what changed could be added here in future)
  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task updated by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'Task updated successfully',
    task,
  });
});

export const claimTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.claimTask(req.params.taskId, user.id);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'CREATE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task claimed by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'You have claimed the task. Wait until confirmation.',
    status: 'PENDING_APPROVAL',
    task,
  });
});

export const approveClaim = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.approveClaim(
    req.params.taskId,
    user.id,
    user.role,
  );

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task claim APPROVED by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'Task claim approved successfully',
    task,
  });
});

export const rejectClaim = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.rejectClaim(
    req.params.taskId,
    user.id,
    user.role,
  );

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task claim REJECTED by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'Task claim rejected successfully',
    task,
  });
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = (await taskService.getTaskById(req.params.taskId)) as any;

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  const isSuperAdmin = user.role === Role.SUPERADMIN;
  const isPm = task.project.pmId === user.id;

  if (!isSuperAdmin && !isPm) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Not authorized to delete this task',
    );
  }

  await taskService.deleteTaskById(req.params.taskId);

  // Manual Audit Log
  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'DELETE',
    entity: 'Task',
    actionReceiver: `Task: ${task.title}`,
    description: `Task deleted by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });

  res.status(httpStatus.NO_CONTENT).send();
});

export const getProjectTasks = catchAsync(
  async (req: Request, res: Response) => {
    const filter = pick(req.query, ['assignedTo', 'status', 'priority']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const { projectId } = req.params;

    const { result, total, page, limit } = await taskService.queryTasks(
      { ...filter, projectId },
      options,
    );
    res.status(httpStatus.OK).json({
      message: 'Project tasks retrieved successfully',
      result,
      total,
      page,
      limit,
    });
  },
);

export const getClaimedTasks = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const result = await taskService.getClaimedTasksGroupedByProject(
      user.id,
      user.role,
    );
    res.status(httpStatus.OK).json({
      message: 'Claimed tasks retrieved successfully',
      result,
    });
  },
);
