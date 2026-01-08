import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as projectService from '../services/project.service';
import { Request, Response } from 'express';

import { Role } from '@prisma/client';

export const createProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
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
  res.status(httpStatus.OK).json({
    message: 'Project updated successfully',
    project,
  });
});

export const deleteProject = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  await projectService.deleteProjectById(req.params.projectId);
  res.status(httpStatus.NO_CONTENT).send();
});

export const assignPm = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  const project = await projectService.assignPmToProject(
    req.params.projectId,
    req.body.pmId,
  );
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
  res.status(httpStatus.CREATED).json({ message: 'Member added successfully' });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  // Access control handled by canAccessProject middleware
  await projectService.removeMemberFromProject(
    req.params.projectId,
    req.params.userId,
  );
  res.status(httpStatus.NO_CONTENT).send();
});
