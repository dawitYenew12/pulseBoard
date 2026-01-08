import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import { Role, TokenType } from '@prisma/client';
import config from '../config/config';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import { getUserById, formatUser } from '../services/user.service';
import { TokenPayload } from '../types/token.types';

export const auth =
  (...requiredRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(
        new ApiError(httpStatus.UNAUTHORIZED, 'Access token is required'),
      );
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secretKey) as TokenPayload;

      if (decoded.type !== TokenType.ACCESS) {
        throw new Error('Invalid access token');
      }

      const user = await getUserById(decoded.sub);
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      if (!user.isVerified) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'Account not verified. Please verify your email to perform actions.',
        );
      }

      // Check if a valid refresh token exists for this user
      const activeRefreshToken = await prisma.refreshToken.findFirst({
        where: {
          userId: user.id,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!activeRefreshToken) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid access token');
      }

      const userRole = user.role;
      console.log('user role: ', userRole);
      console.log('required roles: ', requiredRoles);
      if (requiredRoles.length && !requiredRoles.includes(userRole)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }

      req.user = formatUser(user);
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(
        new ApiError(httpStatus.UNAUTHORIZED, 'Invalid access token'),
      );
    }
  };
