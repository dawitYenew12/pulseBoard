import { z } from 'zod';
import { password } from './custom.validation';

export const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    password: password,
  }),
};
