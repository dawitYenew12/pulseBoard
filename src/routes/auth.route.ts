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

const router = express.Router();

router.post('/signup', validate(createUserSchema), signup);
router.post('/login', validate(loginSchema), login);
router.route('/verify-email').get(verifyEmail).post(verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
