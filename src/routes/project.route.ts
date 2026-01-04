import express from 'express';
import { validate } from '../middlewares/validate';
import * as projectValidation from '../validations/project.validation';
import * as projectController from '../controllers/project.controller';
import { auth } from '../middlewares/auth.middleware';
import { canAccessProject } from '../middlewares/authorization.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

// Project CRUD
router
  .route('/')
  .post(
    auth(Role.SUPERADMIN),
    validate(projectValidation.createProject),
    projectController.createProject,
  )
  .get(
    auth(),
    validate(projectValidation.getProjects),
    projectController.getProjects,
  );

router
  .route('/:projectId')
  .get(
    auth(),
    canAccessProject(),
    validate(projectValidation.getProject),
    projectController.getProject,
  )
  .patch(
    auth(Role.PM, Role.SUPERADMIN),
    canAccessProject(),
    validate(projectValidation.updateProject),
    projectController.updateProject,
  )
  .delete(
    auth(Role.SUPERADMIN),
    // canAccessProject(), // Not strictly needed for SuperAdmin but good for existence check, though delete usually idempotent-ish or handles 404. Let's add it for consistency.
    canAccessProject(),
    validate(projectValidation.deleteProject),
    projectController.deleteProject,
  );

// Project Members Management
router
  .route('/:projectId/assign-pm')
  .patch(
    auth(Role.SUPERADMIN),
    canAccessProject(),
    validate(projectValidation.assignPm),
    projectController.assignPm,
  );

router
  .route('/:projectId/members')
  .post(
    auth(Role.PM, Role.SUPERADMIN),
    canAccessProject(),
    validate(projectValidation.addMember),
    projectController.addMember,
  );

router
  .route('/:projectId/members/:userId')
  .delete(
    auth(Role.PM, Role.SUPERADMIN),
    canAccessProject(),
    validate(projectValidation.removeMember),
    projectController.removeMember,
  );

export default router;
