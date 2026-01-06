import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/CatchAsync';
import * as userService from '../services/user.service';
import { Request, Response } from 'express';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const { user } = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).json({
    message: 'User created successfully',
    user,
  });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['email', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
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
