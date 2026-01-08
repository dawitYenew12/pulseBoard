import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as projectService from '../services/project.service';
import { Request, Response } from 'express';

import { Role } from '@prisma/client';

import * as auditService from '../services/audit.service';
import * as userService from '../services/user.service';

export const createProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
  const user = req.user as any;

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'CREATE',
    entity: 'Project',
    actionReceiver: `Project: ${project.name}`,
    description: `Project created by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.CREATED).json({
    message: 'Project created successfully',
    project,
  });
});

export const getProjects = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'pmId', 'memberId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // If user is not SUPERADMIN, restrict to their projects
  if (req.user!.role !== Role.SUPERADMIN) {
    (filter as any).memberId = req.user!.id;
  }

  const result = await projectService.queryProjects(filter, options);
  res.status(httpStatus.OK).json({
    message: 'Projects retrieved successfully',
    result,
  });
});

export const getProject = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  // We re-fetch to get all relations formatted as per service
  const project = await projectService.getProjectById(req.params.projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  res.status(httpStatus.OK).json({
    message: 'Project retrieved successfully',
    project,
  });
});

export const updateProject = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  const project = await projectService.updateProjectById(
    req.params.projectId,
    req.body,
  );
  const user = req.user as any;

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Project',
    actionReceiver: `Project: ${project.name}`,
    description: `Project updated by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'Project updated successfully',
    project,
  });
});

export const deleteProject = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  const user = req.user as any;
  const project = await projectService.getProjectById(req.params.projectId);

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  await projectService.deleteProjectById(req.params.projectId);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'DELETE',
    entity: 'Project',
    actionReceiver: `Project: ${project.name}`,
    description: `Project deleted by ${user.firstName} ${user.lastName}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.NO_CONTENT).send();
});

export const assignPm = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  const project = await projectService.assignPmToProject(
    req.params.projectId,
    req.body.pmId,
  );
  const user = req.user as any;
  const pm = await userService.getUserById(req.body.pmId);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Project',
    actionReceiver: `Project: ${project.name}`,
    description: `PM assigned: ${pm ? pm.email : req.body.pmId} to ${project.name}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.OK).json({
    message: 'Project manager assigned successfully',
    project,
  });
});

export const addMember = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  await projectService.addMemberToProject(
    req.params.projectId,
    req.body.userId,
  );

  const user = req.user as any;
  const project = await projectService.getProjectById(req.params.projectId);
  const member = await userService.getUserById(req.body.userId);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Project',
    actionReceiver: `Project: ${project?.name || req.params.projectId}`,
    description: `Member added: ${member ? member.email : req.body.userId} to ${project?.name || 'Project'}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.CREATED).json({ message: 'Member added successfully' });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  const user = req.user as any;
  // Get project before removing member to log name?
  // Actually might fail if access is lost, but user is typically PM/Admin.

  // We need project name. fetch it first.
  const project = await projectService.getProjectById(req.params.projectId);

  await projectService.removeMemberFromProject(
    req.params.projectId,
    req.params.userId,
  );

  const member = await userService.getUserById(req.params.userId);

  await auditService.createLog({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    action: 'UPDATE',
    entity: 'Project',
    actionReceiver: `Project: ${project?.name || req.params.projectId}`,
    description: `Member removed: ${member ? member.email : req.params.userId} from ${project?.name || 'Project'}`,
    ipAddress: req.ip,
    endpoint: req.originalUrl,
  });
  res.locals.skipAuditLog = true;

  res.status(httpStatus.NO_CONTENT).send();
});
