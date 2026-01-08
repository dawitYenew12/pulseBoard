import { z } from 'zod';

export const getLogs = {
  query: z.object({
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
    entity: z.string().optional(),
    entityId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
  }),
};
