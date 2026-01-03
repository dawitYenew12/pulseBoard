import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import { Role, TokenType } from '@prisma/client';
import config from '../config/config';
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

      const user = await getUserById(decoded.subject);
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      const userRole = user.role;

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
