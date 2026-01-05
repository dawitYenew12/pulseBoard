import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@prisma/client';

export const createTask = {
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime().optional().or(z.date().optional()),
    projectId: z.string().uuid('Project ID must be a valid UUID'),
    assignedTo: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  }),
};

export const getTasks = {
  query: z.object({
    projectId: z.string().uuid().optional(),
    assignedTo: z.string().uuid().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sortBy: z.string().optional(),
    limit: z.number().int().positive().optional(),
    page: z.number().int().positive().optional(),
  }),
};

export const getTask = {
  params: z.object({
    taskId: z.string().uuid(),
  }),
};

export const updateTask = {
  params: z.object({
    taskId: z.string().uuid(),
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      priority: z.nativeEnum(TaskPriority).optional(),
      dueDate: z.string().datetime().optional().or(z.date().optional()),
      assignedTo: z.string().uuid().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};

export const deleteTask = {
  params: z.object({
    taskId: z.string().uuid(),
  }),
};

export const getProjectTasks = {
  params: z.object({
    projectId: z.string().uuid(),
  }),
  query: z.object({
    assignedTo: z.string().uuid().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sortBy: z.string().optional(),
    limit: z.number().int().positive().optional(),
    page: z.number().int().positive().optional(),
  }),
};
