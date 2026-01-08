import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { auth } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/stats', auth(), dashboardController.getStats);

export default router;
