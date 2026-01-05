import { TokenType, Role } from '@prisma/client';
import { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';
import dayjs from 'dayjs';

export interface TokenPayload extends BaseJwtPayload {
  sub: string;
  iat: number;
  exp: number;
  type: TokenType;
  role: Role;
}

export interface TokenResponse {
  token: string;
  expires: Date;
}

export interface AuthTokensResponse {
  access: TokenResponse;
  refresh: TokenResponse;
}

export interface SaveTokenInput {
  token: string;
  userId: string;
  expires: dayjs.Dayjs;
  type: TokenType;
  revoked?: boolean;
}

export interface GenerateTokenInput {
  userId: string;
  role: Role;
  expires: dayjs.Dayjs;
  type: TokenType;
  secret?: string;
}
