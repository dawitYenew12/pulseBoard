import { z } from 'zod';
import { password } from './custom.validation';
import { Role } from '@prisma/client';

export const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    password: password,
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name must be less than 50 characters'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name must be less than 50 characters'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
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

export const getUsers = {
  query: z.object({
    email: z.string().optional(),
    role: z.nativeEnum(Role).optional(),
    isVerified: z.preprocess((val) => {
      if (val === undefined || val === null) return undefined;
      return val === 'true' || val === true;
    }, z.boolean().optional()),
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
  }),
};

export const getUser = {
  params: z.object({
    userId: z.string().uuid(),
  }),
};

export const updateUserRole = {
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    role: z.nativeEnum(Role, {
      message: 'Invalid role. Must be SUPERADMIN, PM, or EMPLOYEE',
    }),
  }),
};

export const getUserProjects = {
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
  }),
};
