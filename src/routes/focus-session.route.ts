import express from 'express';
import { validate } from '../middlewares/validate';
import * as focusValidation from '../validations/focus-session.validation';
import * as focusController from '../controllers/focus-session.controller';
import { auth } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

router.use(auth()); // All endpoints require authentication basic level

router.post(
  '/',
  auth(Role.EMPLOYEE), // Strict check for start session
  validate(focusValidation.startSession),
  focusController.startSession,
);

router.get('/active', focusController.getActiveSession);

router.get(
  '/analytics',
  validate(focusValidation.getAnalytics),
  focusController.getAnalytics,
);

router.post(
  '/:sessionId/stop',
  validate(focusValidation.stopSession),
  focusController.stopSession,
);

export default router;
