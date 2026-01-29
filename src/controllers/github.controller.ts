import { Request, Response } from 'express';
import httpStatus from 'http-status';
import crypto from 'crypto';
import { catchAsync } from '../utils/CatchAsync';
import * as githubService from '../services/github.service';
import { prisma } from '../config/prisma';
import config from '../config/config';

/**
 * Check if GitHub integration is configured
 */
export const getGitHubStatus = catchAsync(
  async (req: Request, res: Response) => {
    const isConfigured = githubService.isGitHubConfigured();

    res.status(httpStatus.OK).json({
      configured: isConfigured,
      installUrl: isConfigured ? githubService.getInstallationUrl() : null,
    });
  },
);

/**
 * Get OAuth authorization URL for linking GitHub account
 */
export const getOAuthUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  if (!userId) {
    res.status(httpStatus.UNAUTHORIZED).json({
      message: 'User not authenticated',
    });
    return;
  }

  // Create a state with user ID for callback verification
  const state = Buffer.from(
    JSON.stringify({
      userId,
      timestamp: Date.now(),
    }),
  ).toString('base64');

  const url = githubService.getOAuthUrl(state);

  res.status(httpStatus.OK).json({ url, state });
});

/**
 * Handle OAuth callback - link GitHub username to user
 */
export const handleOAuthCallback = catchAsync(
  async (req: Request, res: Response) => {
    const { code, state } = req.body;

    if (!code || !state) {
      res.status(httpStatus.BAD_REQUEST).json({
        message: 'Missing code or state parameter',
      });
      return;
    }

    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      res.status(httpStatus.BAD_REQUEST).json({
        message: 'Invalid state parameter',
      });
      return;
    }

    // Verify the request is from the authenticated user
    const authenticatedUserId = (req as any).user?.id;
    if (stateData.userId !== authenticatedUserId) {
      res.status(httpStatus.FORBIDDEN).json({
        message: 'State does not match authenticated user',
      });
      return;
    }

    // Exchange code for user info
    const { githubUsername } =
      await githubService.exchangeCodeForUserInfo(code);

    // Update user's GitHub username
    const updatedUser = await prisma.user.update({
      where: { id: authenticatedUserId },
      data: { githubUsername },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        githubUsername: true,
      },
    });

    // Also update any ProjectMember records for this user
    await prisma.projectMember.updateMany({
      where: {
        userId: authenticatedUserId,
        githubUsername: null,
      },
      data: {
        githubUsername,
        githubStatus: 'LINKED',
      },
    });

    res.status(httpStatus.OK).json({
      message: 'GitHub account linked successfully',
      user: updatedUser,
    });
  },
);

/**
 * Unlink GitHub account from user
 */
export const unlinkGitHub = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  if (!userId) {
    res.status(httpStatus.UNAUTHORIZED).json({
      message: 'User not authenticated',
    });
    return;
  }

  // Clear user's GitHub username
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { githubUsername: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      githubUsername: true,
    },
  });

  res.status(httpStatus.OK).json({
    message: 'GitHub account unlinked successfully',
    user: updatedUser,
  });
});

/**
 * Handle GitHub App installation callback
 */
export const handleInstallationCallback = catchAsync(
  async (req: Request, res: Response) => {
    const { installation_id } = req.body;

    if (!installation_id) {
      res.status(httpStatus.BAD_REQUEST).json({
        message: 'Missing installation_id',
      });
      return;
    }

    // Verify the installation exists and get repositories
    try {
      const repositories =
        await githubService.listInstallationRepositories(installation_id);

      res.status(httpStatus.OK).json({
        installationId: installation_id,
        repositories,
      });
    } catch (error: any) {
      res.status(httpStatus.BAD_REQUEST).json({
        message: `Failed to verify installation: ${error.message}`,
      });
      return;
    }
  },
);

/**
 * List repositories for an installation
 */
export const listRepositories = catchAsync(
  async (req: Request, res: Response) => {
    const { installationId } = req.params;

    if (!installationId) {
      res.status(httpStatus.BAD_REQUEST).json({
        message: 'Missing installationId',
      });
      return;
    }

    const repositories =
      await githubService.listInstallationRepositories(installationId);

    res.status(httpStatus.OK).json({ repositories });
  },
);

/**
 * Link a repository to a project
 */
export const linkRepository = catchAsync(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { installationId, owner, repo } = req.body;

    if (!installationId || !owner || !repo) {
      res.status(httpStatus.BAD_REQUEST).json({
        message: 'Missing required fields: installationId, owner, repo',
      });
      return;
    }

    const project = await githubService.linkRepositoryToProject(
      projectId,
      installationId,
      owner,
      repo,
    );

    res.status(httpStatus.OK).json({
      message: 'Repository linked successfully',
      project,
    });
  },
);

/**
 * Unlink repository from a project
 */
export const unlinkRepository = catchAsync(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const project = await githubService.unlinkRepositoryFromProject(projectId);

    res.status(httpStatus.OK).json({
      message: 'Repository unlinked successfully',
      project,
    });
  },
);

/**
 * Manually trigger commit sync for a project
 */
export const syncProjectCommits = catchAsync(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Start sync in background
    githubService.syncProjectCommits(projectId).catch((error) => {
      console.error(`Sync failed for project ${projectId}:`, error.message);
    });

    res.status(httpStatus.ACCEPTED).json({
      message: 'Sync started. This may take a few moments.',
    });
  },
);

/**
 * Get commit activity for a project (heatmap data)
 */
export const getProjectActivity = catchAsync(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { userId } = req.query;

    const activity = await githubService.getProjectCommitActivity(
      projectId,
      userId as string | undefined,
    );

    res.status(httpStatus.OK).json({ activity });
  },
);

/**
 * Get contribution stats for a project
 */
export const getProjectStats = catchAsync(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const stats = await githubService.getProjectContributionStats(projectId);

    res.status(httpStatus.OK).json(stats);
  },
);

/**
 * Handle GitHub webhook events
 */
export const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  // Verify webhook signature
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = (req as any).rawBody;

  if (config.github.webhookSecret && rawBody) {
    const hmac = crypto.createHmac('sha256', config.github.webhookSecret);
    const digest = Buffer.from(
      'sha256=' + hmac.update(rawBody).digest('hex'),
      'utf8',
    );
    const checksum = Buffer.from(signature || '', 'utf8');

    if (
      checksum.length !== digest.length ||
      !crypto.timingSafeEqual(digest, checksum)
    ) {
      console.error('Invalid GitHub webhook signature');
      res.status(httpStatus.UNAUTHORIZED).send('Invalid signature');
      return;
    }
  } else if (config.github.webhookSecret && !rawBody) {
    console.error('Missing raw body for webhook verification');
    res.status(httpStatus.BAD_REQUEST).send('Missing body');
    return;
  }

  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  // Handle different webhook events
  switch (event) {
    case 'push':
      // A push was made - could trigger sync
      const installationId = payload.installation?.id?.toString();
      const repoFullName = payload.repository?.full_name;

      if (installationId && repoFullName) {
        // Find projects linked to this repo and sync them
        const [owner, repo] = repoFullName.split('/');
        const projects = await prisma.project.findMany({
          where: {
            githubInstallationId: installationId,
            githubOwner: owner,
            githubRepo: repo,
          },
        });

        for (const project of projects) {
          githubService.syncProjectCommits(project.id).catch((error) => {
            console.error(
              `Webhook sync failed for project ${project.id}:`,
              error.message,
            );
          });
        }
      }
      break;

    case 'installation':
      // App was installed or uninstalled
      // Could notify users or update records
      break;

    case 'installation_repositories':
      // Repository access was added or removed
      break;

    default:
      // Unknown event - log it
      console.log(`Received unknown webhook event: ${event}`);
  }

  res.status(httpStatus.OK).json({ received: true });
});
