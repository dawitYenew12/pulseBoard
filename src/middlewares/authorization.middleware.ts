import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import { UserResponse } from '../types/user.types';

/**
 * Middleware to check if user can access a project
 * - SUPERADMIN: Can access all projects
 * - PM: Can only access projects they are assigned to
 * - EMPLOYEE: Can only access projects they are members of
 */
export const canAccessProject = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const currentUser = req.user as UserResponse;
    const projectId = req.params.projectId;

    if (!currentUser) {
      return next(
        new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'),
      );
    }

    // SUPERADMIN can access all projects
    if (currentUser.role === Role.SUPERADMIN) {
      return next();
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        projectMembers: {
          select: { userId: true },
        },
      },
    });

    if (!project) {
      return next(new ApiError(httpStatus.NOT_FOUND, 'Project not found'));
    }

    // Check PM access
    if (currentUser.role === Role.PM) {
      if (project.pmId !== currentUser.id) {
        return next(
          new ApiError(
            httpStatus.FORBIDDEN,
            'You do not have access to this project',
          ),
        );
      }
    }

    // Check Employee access
    if (currentUser.role === Role.EMPLOYEE) {
      const isMember = project.projectMembers.some(
        (m) => m.userId === currentUser.id,
      );
      if (!isMember) {
        return next(
          new ApiError(
            httpStatus.FORBIDDEN,
            'You are not a member of this project',
          ),
        );
      }
    }

    // Store project in request for reuse
    (req as any).project = project;
    next();
  };
};

/**
 * Generic resource ownership check
 * Checks if the authenticated user owns the resource or has elevated privileges
 */
export const checkResourceOwnership = (
  resourceIdParam: string,
  allowedRoles: Role[] = [Role.SUPERADMIN],
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentUser = req.user as UserResponse;
    const resourceOwnerId = req.params[resourceIdParam];

    if (!currentUser) {
      return next(
        new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'),
      );
    }

    // Check if user has allowed role
    if (allowedRoles.includes(currentUser.role)) {
      return next();
    }

    // Check if user owns the resource
    if (currentUser.id !== resourceOwnerId) {
      return next(
        new ApiError(
          httpStatus.FORBIDDEN,
          'You do not have permission to access this resource',
        ),
      );
    }

    next();
  };
};
