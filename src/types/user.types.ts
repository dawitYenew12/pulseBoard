import { Role } from '@prisma/client';

export interface UserBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
