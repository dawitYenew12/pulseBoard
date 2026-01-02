import httpStatus from 'http-status';
import bcrypt from 'bcryptjs';
import * as userService from './user.service';
import ApiError from '../utils/ApiError';
import { User } from '@prisma/client';

import { formatUser } from './user.service';
import { UserResponse } from '../types/user.types';

/**
 * Login with username and password
 */
export const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
): Promise<UserResponse> => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return formatUser(user);
};
