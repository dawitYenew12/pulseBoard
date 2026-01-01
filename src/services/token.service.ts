import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { TokenType, Token, Role } from '@prisma/client';
import config from '../config/config';
import { tokenTypes } from '../config/token';
import { prisma } from '../config/prisma';
import {
  AuthTokensResponse,
  GenerateTokenInput,
  SaveTokenInput,
  TokenPayload,
  TokenResponse,
} from '../types/token.types';

/**
 * Save a token to the database
 */
export const saveToken = async ({
  token,
  userId,
  expires,
  type,
  revoked = false,
}: SaveTokenInput): Promise<Token> => {
  const tokenDoc = await prisma.token.create({
    data: {
      token,
      userId,
      expires: expires.toDate(),
      type,
      revoked,
    },
  });

  return tokenDoc;
};

/**
 * Verify a token by decoding it and checking if it exists in the database
 */
export const verifyToken = async (
  token: string,
  type: TokenType,
): Promise<Token> => {
  const payload = jwt.verify(token, config.jwt.secretKey) as TokenPayload;

  const tokenDoc = await prisma.token.findFirst({
    where: {
      token,
      userId: payload.subject,
      type,
      revoked: false,
    },
  });

  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate a JWT token
 */
export const generateToken = ({
  userId,
  role,
  expires,
  type,
  secret = config.jwt.secretKey,
}: GenerateTokenInput): string => {
  const payload = {
    subject: userId,
    role,
    issueDate: dayjs().unix(),
    expTime: expires.unix(),
    type,
  };

  return jwt.sign(payload, secret);
};

/**
 * Generate both access and refresh tokens for authentication
 */
export const generateAuthTokens = async (
  userId: string,
  role: Role,
): Promise<AuthTokensResponse> => {
  const accessTokenExpires = dayjs().add(
    config.jwt.accessTokenMinutes,
    'minutes',
  );

  const accessToken = generateToken({
    userId,
    role,
    expires: accessTokenExpires,
    type: tokenTypes.ACCESS,
  });

  const refreshTokenExpires = dayjs().add(config.jwt.refreshTokenDays, 'days');

  const refreshToken = generateToken({
    userId,
    role,
    expires: refreshTokenExpires,
    type: tokenTypes.REFRESH,
  });

  await saveToken({
    token: refreshToken,
    userId,
    expires: refreshTokenExpires,
    type: tokenTypes.REFRESH,
  });

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

/**
 * Generate a verification token for email verification
 */
export const generateVerificationToken = async (
  userId: string,
  role: Role,
): Promise<TokenResponse> => {
  const verificationTokenExpires = dayjs().add(
    config.jwt.verificationTokenMinutes,
    'minutes',
  );

  const emailVerificationToken = generateToken({
    userId,
    role,
    expires: verificationTokenExpires,
    type: tokenTypes.VERIFICATION,
  });

  await saveToken({
    token: emailVerificationToken,
    userId,
    expires: verificationTokenExpires,
    type: tokenTypes.VERIFICATION,
  });

  return {
    token: emailVerificationToken,
    expires: verificationTokenExpires.toDate(),
  };
};

const tokenService = {
  generateAuthTokens,
  generateVerificationToken,
  verifyToken,
  saveToken,
  generateToken,
};

export default tokenService;
