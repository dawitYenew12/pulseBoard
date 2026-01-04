import express from 'express';
import { validate } from '../middlewares/validate';
import * as taskValidation from '../validations/task.validation';
import * as taskController from '../controllers/task.controller';
import { auth } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

router
  .route('/')
  .post(
    auth(Role.SUPERADMIN, Role.PM), // Only PM/Admin can create
    validate(taskValidation.createTask),
    taskController.createTask,
  )
  .get(
    auth(), // All authenticated can list (controller filters access)
    validate(taskValidation.getTasks),
    taskController.getTasks,
  );

router
  .route('/:taskId')
  .get(auth(), validate(taskValidation.getTask), taskController.getTask)
  .patch(
    auth(), // Any auth user can TRY, service checks permission (PM vs Assignee)
    validate(taskValidation.updateTask),
    taskController.updateTask,
  )
  .delete(
    auth(Role.SUPERADMIN, Role.PM),
    validate(taskValidation.deleteTask),
    taskController.deleteTask,
  );

router.route('/:taskId/claim').post(
  auth(), // Any project member can claim
  validate(taskValidation.getTask), // Uses same params validation (taskId)
  taskController.claimTask,
);

router.route('/:taskId/approve-claim').post(
  auth(Role.SUPERADMIN, Role.PM),
  validate(taskValidation.getTask), // Reusing param validation
  taskController.approveClaim,
);

router.route('/:taskId/reject-claim').post(
  auth(Role.SUPERADMIN, Role.PM),
  validate(taskValidation.getTask), // Reusing param validation
  taskController.rejectClaim,
);

export default router;
