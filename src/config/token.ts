import { TokenType } from '@prisma/client';

export const tokenTypes = {
  ACCESS: TokenType.ACCESS,
  REFRESH: TokenType.REFRESH,
  VERIFICATION: TokenType.VERIFICATION,
  RESET_PASSWORD: TokenType.RESET_PASSWORD,
} as const;
