import { z } from 'zod';

export const createProject = {
  body: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    pmId: z.uuid().optional(),
  }),
};

export const getProjects = {
  query: z.object({
    name: z.string().optional(),
    pmId: z.string().uuid().optional(),
    memberId: z.string().uuid().optional(),
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    page: z.coerce.number().int().optional(),
  }),
};

export const getProject = {
  params: z.object({
    projectId: z.uuid(),
  }),
};

export const updateProject = {
  params: z.object({
    projectId: z.uuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      pmId: z.string().uuid().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};

export const deleteProject = {
  params: z.object({
    projectId: z.string().uuid(),
  }),
};

export const assignPm = {
  params: z.object({
    projectId: z.string().uuid(),
  }),
  body: z.object({
    pmId: z.string().uuid('PM ID must be a valid UUID'),
  }),
};

export const addMember = {
  params: z.object({
    projectId: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid('User ID must be a valid UUID'),
  }),
};

export const removeMember = {
  params: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
};
export const getProjectMembers = {
  params: z.object({
    projectId: z.string().uuid(),
  }),
};
