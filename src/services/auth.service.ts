import httpStatus from 'http-status';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userService from './user.service';
import tokenService from './token.service';
import ApiError from '../utils/ApiError';
import { aesDecryptContent } from '../utils/encryption';
import { prisma } from '../config/prisma';
import config from '../config/config';
import { User } from '@prisma/client';
import { formatUser } from './user.service';
import { UserResponse } from '../types/user.types';
import { AuthTokensResponse } from '../types/token.types';

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

/**
 * Refresh authentication tokens
 */
export const refreshAuthTokens = async (
  encryptedRefreshToken: string,
): Promise<AuthTokensResponse> => {
  try {
    // Find the encrypted refresh token in the database
    const refreshTokenDoc = await prisma.refreshToken.findUnique({
      where: {
        token: encryptedRefreshToken,
        revoked: false,
      },
      include: {
        user: true,
      },
    });

    if (!refreshTokenDoc) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token not found');
    }

    // Check if token is expired
    if (refreshTokenDoc.expiresAt < new Date()) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token expired');
    }

    // Decrypt the refresh token
    const decryptedToken = aesDecryptContent(
      refreshTokenDoc.token,
      refreshTokenDoc.iv,
      refreshTokenDoc.salt,
      refreshTokenDoc.authTag,
      refreshTokenDoc.user.email + refreshTokenDoc.user.id,
    );

    // Verify the decrypted JWT
    jwt.verify(decryptedToken, config.jwt.refreshSecret);

    // Delete the old refresh token (single-use)
    await prisma.refreshToken.delete({
      where: {
        id: refreshTokenDoc.id,
      },
    });

    // Generate new auth tokens
    return await tokenService.generateAuthTokens(refreshTokenDoc.user);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Request password reset - generates token and sends email
 */
export const forgotPassword = async (email: string): Promise<void> => {
  const user = await userService.getUserByEmail(email);

  if (!user) {
    // Don't reveal if user exists or not for security reasons
    // Just return success to prevent email enumeration attacks
    return;
  }

  // Generate reset password token
  const resetTokenDoc = await tokenService.generateResetPasswordToken(
    user.id,
    user.role,
  );

  // Send password reset email
  const emailService = require('./email.service').default;
  await emailService.sendPasswordResetEmail(user.email, resetTokenDoc.token);
};
