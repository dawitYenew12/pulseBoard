import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as userService from '../services/user.service';
import * as projectService from '../services/project.service';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const { user } = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).json({
    message: 'User created successfully',
    user,
  });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['email', 'role', 'isVerified']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // RBAC filtering: PM can see all users except SUPERADMIN
  if (req.user?.role === Role.PM) {
    filter.role = { not: Role.SUPERADMIN };
  }

  const result = await userService.queryUsers(filter, options);
  res.status(httpStatus.OK).json({
    message: 'Users retrieved successfully',
    result,
  });
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.status(httpStatus.OK).json({
    message: 'User retrieved successfully',
    user: userService.formatUser(user),
  });
});

export const updateUserRole = catchAsync(
  async (req: Request, res: Response) => {
    const user = await userService.updateUserRole(
      req.params.userId,
      req.body.role,
    );
    res.status(httpStatus.OK).json({
      message: 'User role updated successfully',
      user,
    });
  },
);

export const getProjectMembers = catchAsync(
  async (req: Request, res: Response) => {
    const projectMembers = await userService.getProjectMembers(
      req.params.projectId,
    );
    res.status(httpStatus.OK).json({
      message: 'Project members retrieved successfully',
      projectMembers,
    });
  },
);

export const getUserProjects = catchAsync(
  async (req: Request, res: Response) => {
    const filter = { memberId: req.params.userId } as any;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.queryProjects(filter, options);
    res.status(httpStatus.OK).json({
      message: 'User projects retrieved successfully',
      result,
    });
  },
);
