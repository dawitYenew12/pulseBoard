import { z } from 'zod';
import { password } from './custom.validation';

export const createUserSchema = {
  body: z.object({
    email: z.email(),
    password: password,
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.email(),
    password: z.string(),
  }),
};
