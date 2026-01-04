import { Role } from '@prisma/client';

export interface CreateProjectBody {
  name: string;
  description?: string;
  pmId?: string;
}

export interface UpdateProjectBody {
  name?: string;
  description?: string;
  pmId?: string;
}
