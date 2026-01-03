import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { TokenType, Token, Role, PrismaClient } from '@prisma/client';
import config from '../config/config';
import { tokenTypes } from '../config/token';
import { prisma } from '../config/prisma';
import { aesEncryptContent } from '../utils/encryption';
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
export const saveToken = async (
  { token, userId, expires, type, revoked = false }: SaveTokenInput,
  tx = prisma,
): Promise<Token> => {
  const tokenDoc = await tx.token.create({
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
export const generateAuthTokens = async (user: {
  id: string;
  email: string;
  role: Role;
}): Promise<AuthTokensResponse> => {
  const accessTokenExpires = dayjs().add(
    config.jwt.accessTokenMinutes,
    'minutes',
  );

  const accessToken = generateToken({
    userId: user.id,
    role: user.role,
    expires: accessTokenExpires,
    type: tokenTypes.ACCESS,
  });

  const refreshTokenExpires = dayjs().add(config.jwt.refreshTokenDays, 'days');

  // Refresh Token (now includes role)
  // Matching user request payload structure
  const refreshToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role, // Include role in refresh token
    },
    config.jwt.refreshSecret,
    { expiresIn: '7d' }, // Or use config.jwt.refreshTokenDays
  );

  // Encrypt and store refresh token
  const { encryptedContent, iv, salt, authTag } = await aesEncryptContent(
    refreshToken,
    user.email + user.id,
  );

  // Use RefreshToken model
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: encryptedContent,
      expiresAt: refreshTokenExpires.toDate(),
      iv,
      salt,
      authTag, // Maps to authTag in model (camelCase)
    },
  });

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: encryptedContent, // Return encrypted token for cookie
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
  tx: any = prisma,
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

  await saveToken(
    {
      token: emailVerificationToken,
      userId,
      expires: verificationTokenExpires,
      type: tokenTypes.VERIFICATION,
    },
    tx,
  );

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
