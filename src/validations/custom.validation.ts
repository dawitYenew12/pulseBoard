import { z } from 'zod';

export const password = z
  .string()
  .min(8)
  .refine((value) => {
    return /\d/.test(value) && /[a-zA-Z]/.test(value) && /[\W_]/.test(value);
  }, 'password must be at least 8 characters long and contain at least 1 letter, 1 number, and 1 special character');
