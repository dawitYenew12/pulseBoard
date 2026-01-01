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
  }),
  cors: z.object({
    CORS_ORIGIN: z.string().min(1, 'cors origin is required'),
  }),
  csp: z
    .object({
      CSP_OPTIONS: z.string().optional(),
    })
    .optional(),
});

export type EnvVars = z.infer<typeof envVarSchema>;
