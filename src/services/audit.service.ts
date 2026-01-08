import { prisma } from '../config/prisma';
import { Log } from '@prisma/client';

/**
 * Query for logs
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<Log[]>}
 */
export const queryLogs = async (
  filter: any,
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
  },
): Promise<{ logs: Log[]; total: number }> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const orderBy: any = {};
  if (options.sortBy) {
    const [field, direction] = options.sortBy.split(':');
    if (field && direction) {
      orderBy[field] = direction;
    }
  } else {
    orderBy.createdAt = 'desc';
  }

  const { search, ...restFilter } = filter;
  let where = { ...restFilter };

  if (search) {
    where = {
      ...where,
      OR: [
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { actionReceiver: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.log.count({ where }),
  ]);

  return { logs, total };
};

export const createLog = async (data: {
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  entity: string;
  actionReceiver: string;
  description: string;
  ipAddress?: string;
  endpoint?: string;
}) => {
  const { userId, ...rest } = data;
  return prisma.log.create({
    data: {
      ...rest,
      user: userId ? { connect: { id: userId } } : undefined,
    },
  });
};
