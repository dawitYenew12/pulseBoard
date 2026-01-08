import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

/**
 * Get dashboard stats for a user
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<Object>}
 */
export const getDashboardStats = async (userId: string, role: string) => {
  if (role === Role.SUPERADMIN) {
    // SuperAdmin sees global stats
    const [projects, tasks, users] = await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.user.count(),
    ]);

    return {
      projects,
      tasks,
      users,
    };
  }

  // Regular users (PM, EMPLOYEE) see their own stats
  const [projectCount, taskCount, teamMembersCount] = await Promise.all([
    // 1. Projects the user is part of (either as PM or Member)
    prisma.project.count({
      where: {
        OR: [
          { pmId: userId },
          {
            projectMembers: {
              some: {
                userId: userId,
              },
            },
          },
        ],
      },
    }),

    // 2. Tasks assigned to the user
    prisma.task.count({
      where: {
        assignedTo: userId,
      },
    }),

    // 3. Team Members: Unique users in projects this user belongs to
    // This is a bit complex, might need a raw query or 2-step process for efficiency with Prisma
    // Step A: Get all project IDs the user is part of
    prisma.project
      .findMany({
        where: {
          OR: [{ pmId: userId }, { projectMembers: { some: { userId } } }],
        },
        select: {
          id: true,
        },
      })
      .then(async (projects) => {
        if (projects.length === 0) return 0;

        const projectIds = projects.map((p) => p.id);

        // Step B: Count unique users in those projects
        // We check for users who are either PM of those projects OR members of those projects
        const uniqueUsers = await prisma.user.count({
          where: {
            OR: [
              // Users who are PMs of these projects
              { projectsOwned: { some: { id: { in: projectIds } } } },
              // Users who are members of these projects
              {
                projectMemberships: { some: { projectId: { in: projectIds } } },
              },
            ],
            // Exclude self? Usually "Team Members" implies others, but "Total Network" implies all.
            // Let's include self for now to match "Member count" logic usually seen.
          },
        });
        return uniqueUsers;
      }),
  ]);

  return {
    projects: projectCount,
    tasks: taskCount,
    users: teamMembersCount,
  };
};
