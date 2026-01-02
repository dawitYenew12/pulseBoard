import express from 'express';
import { validate } from '../middlewares/validate';
import { createUserSchema, loginSchema } from '../validations/user.validation';
import { signup, login, verifyEmail } from '../controllers/auth.controller';

const router = express.Router();

router.post('/signup', validate(createUserSchema), signup);
router.post('/login', validate(loginSchema), login);
router.route('/verify-email').get(verifyEmail).post(verifyEmail);

export default router;
