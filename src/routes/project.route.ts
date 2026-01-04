import express from 'express';
import { validate } from '../middlewares/validate';
import * as projectValidation from '../validations/project.validation';
import * as projectController from '../controllers/project.controller';
import { auth } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

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
    validate(projectValidation.getProject),
    projectController.getProject,
  )
  .patch(
    auth(Role.PM, Role.SUPERADMIN),
    validate(projectValidation.updateProject),
    projectController.updateProject,
  )
  .delete(
    auth(Role.SUPERADMIN),
    validate(projectValidation.deleteProject),
    projectController.deleteProject,
  );

// Assign PM to project
router
  .route('/:projectId/assign-pm')
  .patch(
    auth(Role.SUPERADMIN),
    validate(projectValidation.assignPm),
    projectController.assignPm,
  );

// Project member management
router
  .route('/:projectId/members')
  .post(
    auth(Role.PM, Role.SUPERADMIN),
    validate(projectValidation.addMember),
    projectController.addMember,
  );

router
  .route('/:projectId/members/:userId')
  .delete(
    auth(Role.PM, Role.SUPERADMIN),
    validate(projectValidation.removeMember),
    projectController.removeMember,
  );

export default router;
