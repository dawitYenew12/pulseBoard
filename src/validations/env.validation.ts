import { z } from 'zod';

export const envVarSchema = z.object({
  app: z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(5000),
  }),
  db: z.object({
    DATABASE_URL: z.string().url().min(1, 'database url is required'),
  }),
  jwt: z.object({
    JWT_SECRET: z.string().min(1, 'jwt secret is required'),
    JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(15),
    JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(7),
    JWT_VERIFICATION_EXPIRATION_MINUTES: z.coerce.number().default(15),
  }),
  cors: z.object({
    CORS_ORIGIN: z.string().min(1, 'cors origin is required'),
  }),
  csp: z
    .object({
      CSP_OPTIONS: z.string().optional(),
    })
    .optional(),
  email: z.object({
    EMAIL_USER: z.string().email('valid email is required'),
    EMAIL_CLIENT_ID: z.string().min(1, 'email client id is required'),
    EMAIL_CLIENT_SECRET: z.string().min(1, 'email client secret is required'),
    EMAIL_REDIRECT_URI: z.string().url('valid redirect uri is required'),
    EMAIL_REFRESH_TOKEN: z.string().min(1, 'email refresh token is required'),
  }),
});

export type EnvVars = z.infer<typeof envVarSchema>;
