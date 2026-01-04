import httpStatus from 'http-status';
import { FocusSession, Role, TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import * as projectService from './project.service';
import * as taskService from './task.service';
import {
  StartSessionBody,
  FocusSessionStats,
} from '../types/focus-session.types';

/**
 * Start a focus session
 * @param {string} userId
 * @param {string} role - User role
 * @param {StartSessionBody} body
 * @returns {Promise<FocusSession>}
 */
export const startSession = async (
  userId: string,
  role: string,
  body: StartSessionBody,
): Promise<FocusSession> => {
  // 2. Prevent overlapping sessions
  const activeSession = await prisma.focusSession.findFirst({
    where: {
      userId,
      endTime: null,
    },
  });

  if (activeSession) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'You already have an active focus session. Stop it first.',
    );
  }

  // 3. Verify Task Access
  const task = (await taskService.getTaskById(body.taskId)) as any;
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  // Determine if user can work on this task.
  // Requirement: User must be the assignee.
  if (task.assignedTo !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You can only start focus sessions on tasks assigned to you',
    );
  }

  // Optional: Enforce task status? E.g. must be TODO or IN_PROGRESS?
  // Usually IN_PROGRESS makes sense, but the prompt didn't specify.
  // I'll auto-update task status to IN_PROGRESS if it is TODO?
  // That's a nice UX feature. Let's do it if user is assignee.
  if (task.status === TaskStatus.TODO) {
    await prisma.task.update({
      where: { id: body.taskId },
      data: { status: TaskStatus.IN_PROGRESS },
    });
  }

  return prisma.focusSession.create({
    data: {
      userId,
      taskId: body.taskId,
      startTime: new Date(),
    },
  });
};

/**
 * Stop a focus session
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<FocusSession>}
 */
export const stopSession = async (
  sessionId: string,
  userId: string,
): Promise<FocusSession> => {
  const session = await prisma.focusSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Focus session not found');
  }

  if (session.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not own this session');
  }

  if (session.endTime) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Session is already stopped');
  }

  const endTime = new Date();
  const startTime = new Date(session.startTime);
  const durationMin = Math.round(
    (endTime.getTime() - startTime.getTime()) / 1000 / 60,
  );

  return prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      endTime,
      durationMin,
    },
  });
};

/**
 * Get active session for user
 * @param {string} userId
 * @returns {Promise<FocusSession | null>}
 */
export const getActiveSession = async (
  userId: string,
): Promise<FocusSession | null> => {
  return prisma.focusSession.findFirst({
    where: {
      userId,
      endTime: null,
    },
    include: {
      task: true,
    },
  });
};

/**
 * Get analytics (Total focus time per task or for user)
 * @param {string} userId
 * @param {string} [taskId]
 * @returns {Promise<FocusSessionStats>}
 */
export const getAnalytics = async (
  userId: string,
  taskId?: string,
): Promise<FocusSessionStats> => {
  const where: any = {
    userId,
    endTime: { not: null }, // Only count completed sessions
  };

  if (taskId) {
    where.taskId = taskId;
  }

  const aggregate = await prisma.focusSession.aggregate({
    where,
    _sum: {
      durationMin: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalSessions: aggregate._count.id,
    totalDurationMin: aggregate._sum.durationMin || 0,
  };
};
