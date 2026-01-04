import httpStatus from 'http-status';
import { Project, Prisma } from '@prisma/client';
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

  const projects = await prisma.project.findMany({
    where: filter,
    skip,
    take: limit,
    orderBy,
    include: {
      pm: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });
  return projects;
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
        },
      },
      members: {
        select: {
          id: true,
          email: true,
          role: true,
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

  // Verify PM exists and has PM role
  const pm = await prisma.user.findUnique({
    where: { id: pmId },
  });

  if (!pm) {
    throw new ApiError(httpStatus.NOT_FOUND, 'PM user not found');
  }

  if (pm.role !== 'PM' && pm.role !== 'SUPERADMIN') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'User must have PM or SUPERADMIN role',
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
