import httpStatus from 'http-status';
import { Project, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import { CreateProjectBody, UpdateProjectBody } from '../types/project.types';

/**
 * Create a project
 * @param {CreateProjectBody} projectBody
 * @returns {Promise<Project>}
 */
export const createProject = async (
  projectBody: CreateProjectBody,
): Promise<Project> => {
  return prisma.project.create({
    data: projectBody as Prisma.ProjectUncheckedCreateInput,
  });
};

/**
 * Query for projects
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<Project[]>}
 */
export const queryProjects = async (
  filter: Prisma.ProjectWhereInput,
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
  },
): Promise<Project[]> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const orderBy: Prisma.ProjectOrderByWithRelationInput = {};
  if (options.sortBy) {
    const [field, direction] = options.sortBy.split(':');
    if (field && direction) {
      orderBy[field as keyof Prisma.ProjectOrderByWithRelationInput] =
        direction as Prisma.SortOrder;
    }
  } else {
    orderBy.createdAt = 'desc';
  }

  // Create a clean filter by removing undefined/empty values
  const queryFilter: Prisma.ProjectWhereInput = {};

  if (filter.name) {
    queryFilter.name = { contains: filter.name as string, mode: 'insensitive' };
  }

  if (filter.pmId) {
    queryFilter.pmId = filter.pmId;
  }

  if ((filter as any).memberId) {
    const memberId = (filter as any).memberId;
    // When filtering by memberId, we want projects where they are PM OR Member.
    // We should clear pmId from top level if it was set to avoid conflicting filters.
    delete (queryFilter as any).pmId;

    queryFilter.OR = [
      { pmId: memberId },
      {
        projectMembers: {
          some: {
            userId: memberId,
          },
        },
      },
    ];
  }

  const projects = await prisma.project.findMany({
    where: queryFilter,
    skip,
    take: limit,
    orderBy,
    include: {
      pm: {
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
        },
      },
      tasks: {
        select: {
          status: true,
        },
      },
    },
  });

  return projects.map((project: any) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (t: any) => t.status === 'DONE',
    ).length;
    const inProgressTasks = project.tasks.filter(
      (t: any) => t.status === 'IN_PROGRESS',
    ).length;
    const todoTasks = project.tasks.filter(
      (t: any) => t.status === 'TODO' || t.status === 'PENDING_APPROVAL',
    ).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Remove raw tasks array to keep response clean if not needed
    const { tasks, ...projectData } = project;
    return {
      ...projectData,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      progress: Math.round(progress),
    };
  }) as any;
};

/**
 * Get project by id
 * @param {string} id
 * @returns {Promise<Project | null>}
 */
export const getProjectById = async (id: string): Promise<Project | null> => {
  return prisma.project.findUnique({
    where: { id },
    include: {
      pm: {
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
        },
      },
      members: {
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

/**
 * Update project by id
 * @param {string} projectId
 * @param {UpdateProjectBody} updateBody
 * @returns {Promise<Project>}
 */
export const updateProjectById = async (
  projectId: string,
  updateBody: UpdateProjectBody,
): Promise<Project> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: updateBody,
  });
  return updatedProject;
};

/**
/**
 * Check if user can access a project
 * @param {string} projectId
 * @param {string} userId
 * @param {string} userRole
 * @returns {Promise<boolean>}
 */
export const canUserAccessProject = async (
  projectId: string,
  userId: string,
  userRole: string,
): Promise<boolean> => {
  // SUPERADMIN can access all projects
  if (userRole === Role.SUPERADMIN) {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectMembers: {
        where: { userId },
      },
    },
  });

  if (!project) {
    return false;
  }

  // PM can access if they are assigned to the project
  if (userRole === Role.PM && project.pmId === userId) {
    return true;
  }

  // EMPLOYEE can access if they are a member
  if (project.projectMembers.length > 0) {
    return true;
  }

  return false;
};

/**
 * Delete project by id
 * @param {string} projectId
 * @returns {Promise<Project>}
 */
export const deleteProjectById = async (
  projectId: string,
): Promise<Project> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  return prisma.project.delete({
    where: { id: projectId },
  });
};

/**
 * Assign PM to project
 * @param {string} projectId
 * @param {string} pmId
 * @returns {Promise<Project>}
 */
export const assignPmToProject = async (
  projectId: string,
  pmId: string,
): Promise<Project> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Verify PM exists and has appropriate role
  const pm = await prisma.user.findUnique({
    where: { id: pmId },
  });

  if (!pm) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!pm.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is not verified');
  }

  if (pm.role !== Role.PM && pm.role !== Role.SUPERADMIN) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid user for this operation',
    );
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { pmId },
  });
};

/**
 * Add member to project
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const addMemberToProject = async (
  projectId: string,
  userId: string,
): Promise<void> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is not verified');
  }

  // Check if already a member
  const existingMember = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
    },
  });

  if (existingMember) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'User is already a member of this project',
    );
  }

  if (user.role === Role.PM && !project.pmId) {
    await prisma.project.update({
      where: { id: projectId },
      data: { pmId: userId },
    });
  }

  await prisma.projectMember.create({
    data: {
      projectId,
      userId,
    },
  });
};

/**
 * Remove member from project
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const removeMemberFromProject = async (
  projectId: string,
  userId: string,
): Promise<void> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
    },
  });

  if (!member) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'User is not a member of this project',
    );
  }

  await prisma.projectMember.delete({
    where: { id: member.id },
  });
};
