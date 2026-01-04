import express from 'express';
import { validate } from '../middlewares/validate';
import * as userValidation from '../validations/user.validation';
import * as userController from '../controllers/user.controller';
import { auth } from '../middlewares/auth.middleware';
import { checkResourceOwnership } from '../middlewares/authorization.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

// Get all users (paginated) - Only SUPERADMIN and PM can list all users
router
  .route('/')
  .get(
    auth(Role.SUPERADMIN, Role.PM),
    validate(userValidation.getUsers),
    userController.getUsers,
  );

// Get specific user - Users can only see their own details unless they're SUPERADMIN/PM
router.route('/:userId').get(
  auth(), // Must be authenticated
  // Check if user ID in params matches current user, or if user is Admin/PM
  checkResourceOwnership('userId', [Role.SUPERADMIN, Role.PM]),
  validate(userValidation.getUser),
  userController.getUser,
);

// Update user role (SUPERADMIN only)
router
  .route('/:userId/role')
  .patch(
    auth(Role.SUPERADMIN),
    validate(userValidation.updateUserRole),
    userController.updateUserRole,
  );

export default router;
