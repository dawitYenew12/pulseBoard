import { App, Octokit } from 'octokit';
import httpStatus from 'http-status';
import config from '../config/config';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import logger from '../config/logger';

// GitHub App instance (singleton)
let githubApp: App | null = null;

/**
 * Initialize the GitHub App
 * @returns {App | null} GitHub App instance or null if not configured
 */
export const getGitHubApp = (): App | null => {
  if (!config.github.appId || !config.github.privateKey) {
    return null;
  }

  if (!githubApp) {
    // Decode base64 private key if provided in that format
    let privateKey = config.github.privateKey;
    if (privateKey && !privateKey.includes('-----BEGIN')) {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
    }

    githubApp = new App({
      appId: config.github.appId,
      privateKey: privateKey,
      webhooks: {
        secret: config.github.webhookSecret || 'development',
      },
    });
  }

  return githubApp;
};

/**
 * Get an authenticated Octokit instance for an installation
 * @param {string} installationId - GitHub App installation ID
 * @returns {Promise<Octokit>} Authenticated Octokit instance
 */
export const getInstallationOctokit = async (
  installationId: string,
): Promise<Octokit> => {
  const app = getGitHubApp();
  if (!app) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'GitHub App is not configured',
    );
  }

  return app.getInstallationOctokit(parseInt(installationId, 10));
};

/**
 * Get GitHub OAuth authorization URL
 * @param {string} state - State parameter for OAuth flow
 * @returns {string} Authorization URL
 */
export const getOAuthUrl = (state: string): string => {
  if (!config.github.clientId) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'GitHub OAuth is not configured',
    );
  }

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: `${config.corsOrigin}/github/callback`,
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

/**
 * Exchange OAuth code for access token and get user info
 * @param {string} code - OAuth code from callback
 * @returns {Promise<{githubUsername: string, githubId: string}>} GitHub user info
 */
export const exchangeCodeForUserInfo = async (
  code: string,
): Promise<{ githubUsername: string; githubId: string }> => {
  if (!config.github.clientId || !config.github.clientSecret) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'GitHub OAuth is not configured',
    );
  }

  // Exchange code for access token
  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
      }),
    },
  );

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `GitHub OAuth error: ${tokenData.error_description || tokenData.error}`,
    );
  }

  // Get user info with the access token
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userResponse.ok) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Failed to fetch GitHub user info',
    );
  }

  const userData = await userResponse.json();

  return {
    githubUsername: userData.login,
    githubId: userData.id.toString(),
  };
};

/**
 * Get the GitHub App installation URL
 * @returns {string} Installation URL
 */
export const getInstallationUrl = (): string => {
  const app = getGitHubApp();
  if (!app) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'GitHub App is not configured',
    );
  }

  return `https://github.com/apps/pulseboard/installations/new`;
};

/**
 * List repositories accessible by an installation
 * @param {string} installationId - GitHub App installation ID
 * @returns {Promise<any[]>} List of repositories
 */
export const listInstallationRepositories = async (
  installationId: string,
): Promise<any[]> => {
  const octokit = await getInstallationOctokit(installationId);

  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
    per_page: 100,
  });

  return data.repositories.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    description: repo.description,
    defaultBranch: repo.default_branch,
    url: repo.html_url,
  }));
};

/**
 * Fetch commits for a repository
 * @param {string} installationId - GitHub App installation ID
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Date} since - Optional start date
 * @param {Date} until - Optional end date
 * @returns {Promise<any[]>} List of commits with author info
 */
export const fetchRepositoryCommits = async (
  installationId: string,
  owner: string,
  repo: string,
  since?: Date,
  until?: Date,
): Promise<any[]> => {
  const octokit = await getInstallationOctokit(installationId);

  const commits: any[] = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        since: since?.toISOString(),
        until: until?.toISOString(),
        per_page: perPage,
        page,
      });

      if (data.length === 0) break;

      commits.push(
        ...data.map((commit: any) => ({
          sha: commit.sha,
          message: commit.commit.message,
          date: new Date(
            commit.commit.author?.date || commit.commit.committer?.date,
          ),
          authorGithubUsername: commit.author?.login || null,
          authorEmail: commit.commit.author?.email || null,
        })),
      );

      if (data.length < perPage) break;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 50) break;
    }
  } catch (error: any) {
    logger.error(`Error fetching commits for ${owner}/${repo}:`, error.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to fetch commits: ${error.message}`,
    );
  }

  return commits;
};

/**
 * Sync commit activity for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
export const syncProjectCommits = async (projectId: string): Promise<void> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectMembers: {
        include: {
          user: {
            select: {
              id: true,
              githubUsername: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  if (
    !project.githubInstallationId ||
    !project.githubOwner ||
    !project.githubRepo
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Project has no GitHub repository linked',
    );
  }

  // Log sync start
  await prisma.gitHubSyncLog.create({
    data: {
      projectId,
      status: 'STARTED',
      message: 'Sync started',
    },
  });

  try {
    // Fetch commits for the last 365 days (for heatmap)
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const commits = await fetchRepositoryCommits(
      project.githubInstallationId,
      project.githubOwner,
      project.githubRepo,
      since,
    );

    // Build a map of github username to user id
    const usernameToUserId: Record<string, string> = {};
    for (const member of project.projectMembers) {
      if (member.githubUsername) {
        usernameToUserId[member.githubUsername.toLowerCase()] = member.userId;
      }
      if (member.user.githubUsername) {
        usernameToUserId[member.user.githubUsername.toLowerCase()] =
          member.userId;
      }
    }

    // Aggregate commits by date and user
    const activityMap: Record<string, Record<string, number>> = {};

    for (const commit of commits) {
      const dateKey = commit.date.toISOString().split('T')[0];
      const userId = commit.authorGithubUsername
        ? usernameToUserId[commit.authorGithubUsername.toLowerCase()] || null
        : null;
      const userKey = userId || 'unknown';

      if (!activityMap[dateKey]) {
        activityMap[dateKey] = {};
      }
      activityMap[dateKey][userKey] = (activityMap[dateKey][userKey] || 0) + 1;
    }

    // Upsert commit activity records
    for (const [dateStr, userCounts] of Object.entries(activityMap)) {
      const activityDate = new Date(dateStr);

      for (const [userKey, count] of Object.entries(userCounts)) {
        const userId = userKey === 'unknown' ? null : userKey;

        await prisma.commitActivity.upsert({
          where: {
            projectId_userId_activityDate: {
              projectId,
              userId: userId || '',
              activityDate,
            },
          },
          create: {
            projectId,
            userId,
            activityDate,
            commitCount: count,
          },
          update: {
            commitCount: count,
          },
        });
      }
    }

    // Log success
    await prisma.gitHubSyncLog.create({
      data: {
        projectId,
        status: 'SUCCESS',
        message: `Synced ${commits.length} commits`,
      },
    });

    logger.info(`Synced ${commits.length} commits for project ${projectId}`);
  } catch (error: any) {
    // Log failure
    await prisma.gitHubSyncLog.create({
      data: {
        projectId,
        status: 'FAILED',
        message: error.message,
      },
    });

    throw error;
  }
};

/**
 * Get commit activity for a project (for heatmap)
 * @param {string} projectId - Project ID
 * @param {string} userId - Optional user ID to filter by
 * @returns {Promise<any[]>} Commit activity data
 */
export const getProjectCommitActivity = async (
  projectId: string,
  userId?: string,
): Promise<any[]> => {
  const where: any = { projectId };
  if (userId) {
    where.userId = userId;
  }

  const activities = await prisma.commitActivity.findMany({
    where,
    orderBy: { activityDate: 'asc' },
  });

  return activities.map((activity) => ({
    date: activity.activityDate.toISOString().split('T')[0],
    count: activity.commitCount,
    userId: activity.userId,
  }));
};

/**
 * Get project contribution stats
 * @param {string} projectId - Project ID
 * @returns {Promise<any>} Contribution stats
 */
export const getProjectContributionStats = async (
  projectId: string,
): Promise<any> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectMembers: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              githubUsername: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Get activity for the last 365 days
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const activities = await prisma.commitActivity.findMany({
    where: {
      projectId,
      activityDate: { gte: since },
    },
  });

  // Calculate total commits
  const totalCommits = activities.reduce((sum, a) => sum + a.commitCount, 0);

  // Group by user
  const userCommits: Record<string, number> = {};
  for (const activity of activities) {
    const key = activity.userId || 'unknown';
    userCommits[key] = (userCommits[key] || 0) + activity.commitCount;
  }

  // Map to user info
  const contributors = project.projectMembers.map((member) => ({
    userId: member.userId,
    name: `${member.user.firstName} ${member.user.lastName}`,
    githubUsername: member.githubUsername || member.user.githubUsername,
    githubStatus: member.githubStatus,
    commitCount: userCommits[member.userId] || 0,
  }));

  // Calculate active days
  const uniqueDates = new Set(
    activities.map((a) => a.activityDate.toISOString().split('T')[0]),
  );
  const activeDays = uniqueDates.size;

  // Last sync info
  const lastSync = await prisma.gitHubSyncLog.findFirst({
    where: { projectId, status: 'SUCCESS' },
    orderBy: { syncedAt: 'desc' },
  });

  return {
    totalCommits,
    activeDays,
    contributors: contributors.sort((a, b) => b.commitCount - a.commitCount),
    unknownCommits: userCommits['unknown'] || 0,
    lastSyncedAt: lastSync?.syncedAt || null,
    githubRepo: project.githubRepo
      ? `${project.githubOwner}/${project.githubRepo}`
      : null,
  };
};

/**
 * Link GitHub repository to a project
 * @param {string} projectId - Project ID
 * @param {string} installationId - GitHub App installation ID
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<any>} Updated project
 */
export const linkRepositoryToProject = async (
  projectId: string,
  installationId: string,
  owner: string,
  repo: string,
): Promise<any> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Verify we can access the repository
  try {
    const octokit = await getInstallationOctokit(installationId);
    await octokit.rest.repos.get({ owner, repo });
  } catch (error: any) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot access repository ${owner}/${repo}. Ensure the GitHub App is installed with access to this repository.`,
    );
  }

  // Update the project
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      githubInstallationId: installationId,
      githubOwner: owner,
      githubRepo: repo,
    },
  });

  // Trigger initial sync
  syncProjectCommits(projectId).catch((error) => {
    logger.error(
      `Initial sync failed for project ${projectId}:`,
      error.message,
    );
  });

  return updatedProject;
};

/**
 * Unlink GitHub repository from a project
 * @param {string} projectId - Project ID
 * @returns {Promise<any>} Updated project
 */
export const unlinkRepositoryFromProject = async (
  projectId: string,
): Promise<any> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Clear GitHub fields
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      githubInstallationId: null,
      githubOwner: null,
      githubRepo: null,
    },
  });

  // Delete commit activity for this project
  await prisma.commitActivity.deleteMany({
    where: { projectId },
  });

  return updatedProject;
};

/**
 * Get all app installations for the current GitHub App
 * @returns {Promise<any[]>} List of installations
 */
export const getAppInstallations = async (): Promise<any[]> => {
  const app = getGitHubApp();
  if (!app) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'GitHub App is not configured',
    );
  }

  const octokit = await app.getInstallationOctokit(
    parseInt(config.github.appId, 10),
  );

  try {
    // Use the app's octokit to list installations
    const installations: any[] = [];

    // Note: This requires authentication as the app itself, not an installation
    // For now, we'll return an empty array and let the frontend use the installation callback
    return installations;
  } catch (error: any) {
    logger.error('Error fetching app installations:', error.message);
    return [];
  }
};

/**
 * Check if GitHub integration is configured
 * @returns {boolean}
 */
export const isGitHubConfigured = (): boolean => {
  return !!(
    config.github.appId &&
    config.github.privateKey &&
    config.github.clientId &&
    config.github.clientSecret
  );
};
