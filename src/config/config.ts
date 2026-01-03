import dotenv from 'dotenv';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import { envVarSchema, EnvVars } from '../validations/env.validation';

dotenv.config();

const parsed = envVarSchema.safeParse({
  app: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  },
  db: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  jwt: {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRATION_MINUTES: process.env.JWT_ACCESS_EXPIRATION_MINUTES,
    JWT_REFRESH_EXPIRATION_DAYS: process.env.JWT_REFRESH_EXPIRATION_DAYS,
    JWT_VERIFICATION_EXPIRATION_MINUTES:
      process.env.JWT_VERIFICATION_EXPIRATION_MINUTES,
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES:
      process.env.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
  },
  cors: {
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
  csp: {
    CSP_OPTIONS: process.env.CSP_OPTIONS,
  },
  email: {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_CLIENT_ID: process.env.EMAIL_CLIENT_ID,
    EMAIL_CLIENT_SECRET: process.env.EMAIL_CLIENT_SECRET,
    EMAIL_REDIRECT_URI: process.env.EMAIL_REDIRECT_URI,
    EMAIL_REFRESH_TOKEN: process.env.EMAIL_REFRESH_TOKEN,
  },
  encryption: {
    MASTER_KEY: process.env.MASTER_KEY,
  },
  rateLimit: {
    MAX_ATTEMPTS_BY_IP_PER_DAY: process.env.MAX_ATTEMPTS_BY_IP_PER_DAY,
    MAX_CONSECUTIVE_FAILS_BY_EMAIL_AND_IP:
      process.env.MAX_CONSECUTIVE_FAILS_BY_EMAIL_AND_IP,
    MAX_CONSECUTIVE_FAILS_BY_EMAIL: process.env.MAX_CONSECUTIVE_FAILS_BY_EMAIL,
    API_RATE_LIMIT_WINDOW_MINUTES: process.env.API_RATE_LIMIT_WINDOW_MINUTES,
    API_RATE_LIMIT_MAX_REQUESTS: process.env.API_RATE_LIMIT_MAX_REQUESTS,
  },
});
if (!parsed.success) {
  throw new ApiError(
    httpStatus.INTERNAL_SERVER_ERROR,
    'Environment validation error: ' + JSON.stringify(parsed.error.format()),
  );
}
const envVars: EnvVars = parsed.data;

interface Config {
  port: number;
  dbUrl: string;
  env: string;
  corsOrigin: string;
  corsOptions?: string;
  cspOptions?: Record<string, any>;
  jwt: {
    secretKey: string;
    refreshSecret: string;
    accessTokenMinutes: number;
    refreshTokenDays: number;
    verificationTokenMinutes: number;
    resetPasswordTokenMinutes: number;
  };
  email: {
    user: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
  encryption: {
    masterKey: string;
  };
  rateLimit: {
    ipMaxAttemptsPerDay: number;
    emailIpMaxFails: number;
    emailMaxFails: number;
    windowMinutes: number;
    maxRequests: number;
  };
}

const config: Config = {
  port: envVars.app.PORT,
  dbUrl: envVars.db.DATABASE_URL,
  env: envVars.app.NODE_ENV,
  corsOrigin: envVars.cors.CORS_ORIGIN,
  cspOptions: envVars.csp?.CSP_OPTIONS
    ? JSON.parse(envVars.csp.CSP_OPTIONS)
    : undefined,
  jwt: {
    secretKey: envVars.jwt.JWT_SECRET,
    refreshSecret: envVars.jwt.JWT_REFRESH_SECRET,
    accessTokenMinutes: envVars.jwt.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshTokenDays: envVars.jwt.JWT_REFRESH_EXPIRATION_DAYS,
    verificationTokenMinutes: envVars.jwt.JWT_VERIFICATION_EXPIRATION_MINUTES,
    resetPasswordTokenMinutes:
      envVars.jwt.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
  },
  email: {
    user: envVars.email.EMAIL_USER,
    clientId: envVars.email.EMAIL_CLIENT_ID,
    clientSecret: envVars.email.EMAIL_CLIENT_SECRET,
    redirectUri: envVars.email.EMAIL_REDIRECT_URI,
    refreshToken: envVars.email.EMAIL_REFRESH_TOKEN,
  },
  encryption: {
    masterKey: envVars.encryption.MASTER_KEY,
  },
  rateLimit: {
    ipMaxAttemptsPerDay: envVars.rateLimit.MAX_ATTEMPTS_BY_IP_PER_DAY,
    emailIpMaxFails: envVars.rateLimit.MAX_CONSECUTIVE_FAILS_BY_EMAIL_AND_IP,
    emailMaxFails: envVars.rateLimit.MAX_CONSECUTIVE_FAILS_BY_EMAIL,
    windowMinutes: envVars.rateLimit.API_RATE_LIMIT_WINDOW_MINUTES,
    maxRequests: envVars.rateLimit.API_RATE_LIMIT_MAX_REQUESTS,
  },
};

export default config;
