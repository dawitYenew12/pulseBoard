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

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email('Must be a valid email address'),
  }),
};

export const resetPasswordSchema = {
  body: z
    .object({
      token: z.string().min(1, 'Reset token is required'),
      password: password,
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
};
