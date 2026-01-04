import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as taskService from '../services/task.service';
import * as projectService from '../services/project.service';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.createTask(req.body, user.id);
  res.status(httpStatus.CREATED).send(task);
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, [
    'projectId',
    'assignedTo',
    'status',
    'priority',
  ]);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  if (req.query.projectId) {
    const canAccess = await projectService.canUserAccessProject(
      req.query.projectId as string,
      (req.user as any).id,
      (req.user as any).role,
    );
    if (!canAccess) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Cannot access tasks for this project',
      );
    }
  }

  const result = await taskService.queryTasks(filter, options);
  res.send(result);
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

  res.send(task);
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.updateTaskById(
    req.params.taskId,
    req.body,
    user.id,
    user.role as Role,
  );
  res.send(task);
});

export const claimTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  await taskService.claimTask(req.params.taskId, user.id);
  res.status(httpStatus.OK).send({
    message: 'You have claimed the task. Wait until confirmation.',
    status: 'PENDING_APPROVAL',
  });
});

export const approveClaim = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.approveClaim(
    req.params.taskId,
    user.id,
    user.role,
  );
  res.send(task);
});

export const rejectClaim = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const task = await taskService.rejectClaim(
    req.params.taskId,
    user.id,
    user.role,
  );
  res.send(task);
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
  res.status(httpStatus.NO_CONTENT).send();
});
