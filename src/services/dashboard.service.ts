import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

/**
 * Get dashboard stats for a user
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<Object>}
 */
export const getDashboardStats = async (userId: string, role: string) => {
  // Shared helper for task breakdown
  const getTaskBreakdown = async (where: any) => {
    const [statusStats, priorityStats] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      status: statusStats.map((s) => ({ label: s.status, count: s._count.id })),
      priority: priorityStats.map((p) => ({
        label: p.priority,
        count: p._count.id,
      })),
    };
  };

  // Helper for 7-day focus trends
  const getFocusTrends = async (where: any) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Last 7 days including today

    const sessions = await prisma.focusSession.findMany({
      where: {
        ...where,
        startTime: { gte: sevenDaysAgo },
      },
      select: {
        startTime: true,
        durationMin: true,
      },
    });

    const trendsMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendsMap[d.toISOString().split('T')[0]] = 0;
    }

    sessions.forEach((s) => {
      const day = s.startTime.toISOString().split('T')[0];
      if (trendsMap[day] !== undefined) {
        trendsMap[day] += s.durationMin || 0;
      }
    });

    return Object.entries(trendsMap)
      .map(([date, minutes]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        minutes,
      }))
      .sort((a, b) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.indexOf(a.date) - days.indexOf(b.date);
      });
  };

  if (role === Role.SUPERADMIN) {
    const [projects, tasks, users, breakdowns, focusTime, focusTrends] =
      await Promise.all([
        prisma.project.count(),
        prisma.task.count(),
        prisma.user.count({
          where: { role: { not: Role.SUPERADMIN } },
        }),
        getTaskBreakdown({}),
        prisma.focusSession.aggregate({
          _sum: { durationMin: true },
        }),
        getFocusTrends({}),
      ]);

    return {
      projects,
      tasks,
      users,
      statusBreakdown: breakdowns.status,
      priorityBreakdown: breakdowns.priority,
      totalFocusTime: focusTime._sum.durationMin || 0,
      focusTrends,
    };
  }

  // Role-specific filters
  const projectFilter =
    role === Role.PM
      ? { pmId: userId }
      : { projectMembers: { some: { userId } } };

  const taskFilter =
    role === Role.PM ? { project: { pmId: userId } } : { assignedTo: userId };

  const focusFilter =
    role === Role.PM
      ? { task: { project: { pmId: userId } } }
      : { userId: userId };

  const [
    projectCount,
    taskCount,
    breakdowns,
    teamMembersCount,
    focusTime,
    focusTrends,
  ] = await Promise.all([
    prisma.project.count({ where: projectFilter }),
    prisma.task.count({ where: taskFilter }),
    getTaskBreakdown(taskFilter),
    prisma.project
      .findMany({
        where: projectFilter,
        select: { id: true },
      })
      .then(async (projects) => {
        if (projects.length === 0) return 0;
        const projectIds = projects.map((p) => p.id);
        return prisma.user.count({
          where: {
            OR: [
              { projectsOwned: { some: { id: { in: projectIds } } } },
              {
                projectMemberships: { some: { projectId: { in: projectIds } } },
              },
            ],
            role: { not: Role.SUPERADMIN },
          },
        });
      }),
    prisma.focusSession.aggregate({
      where: focusFilter,
      _sum: { durationMin: true },
    }),
    getFocusTrends(focusFilter),
  ]);

  return {
    projects: projectCount,
    tasks: taskCount,
    users: teamMembersCount,
    statusBreakdown: breakdowns.status,
    priorityBreakdown: breakdowns.priority,
    totalFocusTime: focusTime._sum.durationMin || 0,
    focusTrends,
  };
};
