import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import config from '../config/config';
import ApiError from '../utils/ApiError';
import { getUserById, formatUser } from '../services/user.service';
import { TokenPayload } from '../types/token.types';
import { TokenType } from '@prisma/client';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
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

    req.user = formatUser(user);
    next();
  } catch (error) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid access token'));
  }
};
