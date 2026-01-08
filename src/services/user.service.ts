import { User } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import { UserBody, UserResponse } from '../types/user.types';
import bcrypt from 'bcryptjs';
import tokenService from './token.service';
import { sendVerificationEmail } from './email.service';

export const isEmailTaken = async (email: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return !!user;
};

export const formatUser = (user: User): UserResponse => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const createUser = async (
  userBody: UserBody,
): Promise<{ user: UserResponse; verificationToken: string }> => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'User with this email already exists',
    );
  }
  const { email, password, firstName, lastName } = userBody;
  const result = await prisma.$transaction(async (tx) => {
    // hash password and create user
    const hashedPassword = await bcrypt.hash(password, 8);
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    const verificationDoc = await tokenService.generateVerificationToken(
      user.id,
      user.role,
      tx,
    );

    return { user: formatUser(user), verificationToken: verificationDoc.token };
  });

  await sendVerificationEmail(result.user.email, result.verificationToken);

  return result;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return user;
};

export const getUserById = async (id: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
};

/**
 * Query for users
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<UserResponse[]>}
 */
export const queryUsers = async (
  filter: any,
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
  },
): Promise<UserResponse[]> => {
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

  const users = await prisma.user.findMany({
    where: filter,
    skip,
    take: limit,
    orderBy,
  });

  return users.map(formatUser);
};

/**
 * Update user role
 * @param {string} userId
 * @param {Role} role
 * @returns {Promise<UserResponse>}
 */
export const updateUserRole = async (
  userId: string,
  role: User['role'],
): Promise<UserResponse> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is not verified');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return formatUser(updatedUser);
};

/**
 * Update user by id
 * @param {string} userId
 * @param {Object} updateBody
 * @returns {Promise<UserResponse>}
 */
export const updateUserById = async (
  userId: string,
  updateBody: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    currentPassword?: string;
  },
): Promise<UserResponse> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // If trying to update sensitive info (email/password) or if currentPassword is provided, verify it
  if (updateBody.currentPassword) {
    const isPasswordMatch = await bcrypt.compare(
      updateBody.currentPassword,
      user.password,
    );
    if (!isPasswordMatch) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
    }
    // Remove currentPassword from update data so we don't try to save it to DB
    delete updateBody.currentPassword;
  } else {
    // If we want to strictly enforce password for any update, checking if it's missing:
    // throw new ApiError(httpStatus.BAD_REQUEST, 'Current password is required to update profile');
    // But for now, let's assume if the frontend sends it, we verify.
    // If the User request specifically asked "we should ask for password", we should probably enforce it.
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Current password is required to update profile',
    );
  }

  if (
    updateBody.email &&
    (await isEmailTaken(updateBody.email)) &&
    updateBody.email !== user.email
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Hash new password if provided
  if (updateBody.password) {
    updateBody.password = await bcrypt.hash(updateBody.password, 8);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateBody,
  });

  return formatUser(updatedUser);
};

export const getProjectMembers = async (
  projectId: string,
): Promise<UserResponse[]> => {
  // Get the project to find the PM
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pmId: true },
  });

  const members = await prisma.user.findMany({
    where: {
      OR: [
        {
          id: project?.pmId || undefined,
        },
        {
          projectMemberships: {
            some: {
              projectId,
            },
          },
        },
      ],
    },
  });
  return members.map(formatUser);
};
