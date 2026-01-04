import { z } from 'zod';

export const startSession = {
  body: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
};

export const stopSession = {
  params: z.object({
    sessionId: z.string().uuid(),
  }),
};

export const getAnalytics = {
  query: z.object({
    taskId: z.string().uuid().optional(),
  }),
};
