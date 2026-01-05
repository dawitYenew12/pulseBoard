import httpStatus from 'http-status';
import { Task, Prisma, Role, TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import { CreateTaskBody, UpdateTaskBody } from '../types/task.types';
import * as projectService from './project.service';

/**
 * Create a task
 * @param {CreateTaskBody} taskBody
 * @param {string} creatorId
 * @returns {Promise<Task>}
 */
export const createTask = async (
  taskBody: CreateTaskBody,
  creatorId: string,
): Promise<Task> => {
  // Verify project exists
  const project = await projectService.getProjectById(taskBody.projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Verify creator permissions (Must be PM of project or SUPERADMIN)
  const creator = await prisma.user.findUnique({ where: { id: creatorId } });
  if (!creator)
    throw new ApiError(httpStatus.NOT_FOUND, 'Creator user not found');

  if (creator.role !== Role.SUPERADMIN) {
    if (project.pmId !== creatorId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Only Project Manager or Admin can create tasks',
      );
    }
  }

  return prisma.task.create({
    data: {
      ...taskBody,
      creatorId,
      dueDate: taskBody.dueDate ? new Date(taskBody.dueDate) : undefined,
    },
  });
};

/**
 * Query for tasks
 * @param {Object} filter - database filter
 * @param {Object} options - Query options
 * @returns {Promise<Task[]>}
 */
export const queryTasks = async (
  filter: Prisma.TaskWhereInput,
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
  },
): Promise<Task[]> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const orderBy: Prisma.TaskOrderByWithRelationInput = {};
  if (options.sortBy) {
    const [field, direction] = options.sortBy.split(':');
    if (field && direction) {
      // @ts-ignore
      orderBy[field] = direction;
    }
  } else {
    orderBy.createdAt = 'desc';
  }

  const tasks = await prisma.task.findMany({
    where: filter,
    skip,
    take: limit,
    orderBy,
    include: {
      assignee: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      creator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  return tasks;
};

/**
 * Get task by id
 * @param {string} id
 * @returns {Promise<Task | null>}
 */
export const getTaskById = async (id: string): Promise<Task | null> => {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      creator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          pmId: true,
        },
      },
    },
  });
};

/**
 * Update task by id
 * @param {string} taskId
 * @param {UpdateTaskBody} updateBody
 * @param {string} updaterId
 * @param {Role} updaterRole
 * @returns {Promise<Task>}
 */
export const updateTaskById = async (
  taskId: string,
  updateBody: UpdateTaskBody,
  updaterId: string,
  updaterRole: Role,
): Promise<Task> => {
  const task = (await getTaskById(taskId)) as any;
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  const isPm = task.project.pmId === updaterId;
  const isAssignee = task.assignedTo === updaterId;
  const isSuperAdmin = updaterRole === Role.SUPERADMIN;

  if (!isSuperAdmin && !isPm && !isAssignee) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Not authorized to update this task',
    );
  }

  // Safety check for claimed tasks
  if (task.status === TaskStatus.PENDING_APPROVAL) {
    // If trying to reassign to a DIFFERENT user (not null, not current)
    if (
      updateBody.assignedTo !== undefined &&
      updateBody.assignedTo !== null &&
      updateBody.assignedTo !== task.assignedTo
    ) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `This task is currently claimed by ${task.assignee?.email}. You must approve or reject the claim first.`,
      );
    }
  }

  // If Assignee (but not PM/Admin), restrict what they can update
  if (isAssignee && !isPm && !isSuperAdmin) {
    const allowedUpdates = ['status'];
    const updates = Object.keys(updateBody);
    const invalidUpdates = updates.filter((u) => !allowedUpdates.includes(u));

    if (invalidUpdates.length > 0) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Assignees can only update task status',
      );
    }
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...updateBody,
      dueDate: updateBody.dueDate ? new Date(updateBody.dueDate) : undefined,
    },
  });
};

/**
 * Claim a task
 */
export const claimTask = async (
  taskId: string,
  userId: string,
): Promise<Task> => {
  const task = (await getTaskById(taskId)) as any;
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  if (task.status !== TaskStatus.TODO || task.assignedTo) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Task is already assigned or claimed',
    );
  }

  const hasAccess = await projectService.canUserAccessProject(
    task.projectId,
    userId,
    Role.EMPLOYEE,
  );
  if (!hasAccess) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You are not a member of this project',
    );
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      assignedTo: userId,
      status: TaskStatus.PENDING_APPROVAL,
    },
  });
};

/**
 * Approve a task claim
 */
export const approveClaim = async (
  taskId: string,
  updaterId: string,
  updaterRole: Role,
): Promise<Task> => {
  const task = (await getTaskById(taskId)) as any;
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');

  // Check permissions
  const isPm = task.project.pmId === updaterId;
  const isSuperAdmin = updaterRole === Role.SUPERADMIN;
  if (!isPm && !isSuperAdmin)
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized');

  if (task.status !== TaskStatus.PENDING_APPROVAL) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Task is not pending approval');
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.TODO, // Confirmed assignment, ready to work
    },
  });
};

/**
 * Reject a task claim
 */
export const rejectClaim = async (
  taskId: string,
  updaterId: string,
  updaterRole: Role,
): Promise<Task> => {
  const task = (await getTaskById(taskId)) as any;
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');

  // Check permissions
  const isPm = task.project.pmId === updaterId;
  const isSuperAdmin = updaterRole === Role.SUPERADMIN;
  if (!isPm && !isSuperAdmin)
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized');

  if (task.status !== TaskStatus.PENDING_APPROVAL) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Task is not pending approval');
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.TODO,
      assignedTo: null,
    },
  });
};

/**
 * Delete task by id
 */
export const deleteTaskById = async (taskId: string): Promise<Task> => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  return prisma.task.delete({
    where: { id: taskId },
  });
};

/**
 * Get claimed tasks (PENDING_APPROVAL) grouped by project
 * @param {string} userId
 * @param {Role} userRole
 */
export const getClaimedTasksGroupedByProject = async (
  userId: string,
  userRole: Role,
) => {
  const projects = await prisma.project.findMany({
    where: {
      // If PM, only show projects they manage. If SuperAdmin, show all.
      ...(userRole === Role.PM ? { pmId: userId } : {}),
      tasks: {
        some: {
          status: TaskStatus.PENDING_APPROVAL,
        },
      },
    },
    include: {
      tasks: {
        where: {
          status: TaskStatus.PENDING_APPROVAL,
        },
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          creator: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return projects;
};
