import express from 'express';
import { validate } from '../middlewares/validate';
import { createUserSchema } from '../validations/user.validation';
import { signup, verifyEmail } from '../controllers/auth.controller';

const router = express.Router();

router.post('/signup', validate(createUserSchema), signup);
router.route('/verify-email').get(verifyEmail).post(verifyEmail);

export default router;
