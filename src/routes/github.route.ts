import express from 'express';
import * as githubController from '../controllers/github.controller';
import { auth } from '../middlewares/auth.middleware';
import { canAccessProject } from '../middlewares/authorization.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

// GitHub integration status
router.get('/status', githubController.getGitHubStatus);

// OAuth flow for linking GitHub account to user
router.get('/oauth/url', auth(), githubController.getOAuthUrl);
router.post('/oauth/callback', auth(), githubController.handleOAuthCallback);
router.delete('/oauth/unlink', auth(), githubController.unlinkGitHub);

// GitHub App installation callback
router.post(
  '/installation/callback',
  auth(Role.SUPERADMIN, Role.PM),
  githubController.handleInstallationCallback,
);

// List repositories for an installation
router.get(
  '/installations/:installationId/repositories',
  auth(Role.SUPERADMIN, Role.PM),
  githubController.listRepositories,
);

// Project-level GitHub integration
router.post(
  '/projects/:projectId/link',
  auth(Role.SUPERADMIN, Role.PM),
  canAccessProject(),
  githubController.linkRepository,
);

router.delete(
  '/projects/:projectId/unlink',
  auth(Role.SUPERADMIN, Role.PM),
  canAccessProject(),
  githubController.unlinkRepository,
);

router.post(
  '/projects/:projectId/sync',
  auth(Role.SUPERADMIN, Role.PM),
  canAccessProject(),
  githubController.syncProjectCommits,
);

router.get(
  '/projects/:projectId/activity',
  auth(),
  canAccessProject(),
  githubController.getProjectActivity,
);

router.get(
  '/projects/:projectId/stats',
  auth(),
  canAccessProject(),
  githubController.getProjectStats,
);

// GitHub webhooks (no auth - verified via webhook secret)
router.post('/webhooks', githubController.handleWebhook);

export default router;
