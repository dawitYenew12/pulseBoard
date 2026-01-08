import express from 'express';
import { validate } from '../middlewares/validate';
import * as auditValidation from '../validations/audit.validation';
import * as auditController from '../controllers/audit.controller';
import { auth } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

router
  .route('/')
  .get(
    auth(Role.SUPERADMIN),
    validate(auditValidation.getLogs),
    auditController.getLogs,
  );

export default router;
