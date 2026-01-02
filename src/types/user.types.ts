import { Role } from '@prisma/client';

export interface UserBody {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
