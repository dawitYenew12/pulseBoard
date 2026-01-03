import express from 'express';
import { validate } from '../middlewares/validate';
import {
  createUserSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/user.validation';
import {
  signup,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';

import {
  loginRateLimiter,
  signupRateLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../middlewares/auth.limiter';

const router = express.Router();

router.post('/signup', signupRateLimiter, validate(createUserSchema), signup);
router.post('/login', loginRateLimiter, validate(loginSchema), login);
router
  .route('/verify-email')
  .get(verifyEmailLimiter, verifyEmail)
  .post(verifyEmailLimiter, verifyEmail);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

export default router;
