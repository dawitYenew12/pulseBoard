import { TaskStatus, TaskPriority } from '@prisma/client';

export interface CreateTaskBody {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: Date | string; // Dates often come as strings from JSON
  projectId: string;
  assignedTo?: string; // Optional assignee at creation
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | string;
  assignedTo?: string | null; // Allow unassigning
}

export interface TaskFilter {
  projectId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}
