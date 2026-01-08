import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
];

// function maskSensitive(data: any): any {
//   if (!data || typeof data !== 'object') return data;
//   if (Array.isArray(data)) return data.map(maskSensitive);

//   const cleaned = { ...data };
//   Object.keys(cleaned).forEach((key) => {
//     const lowerKey = key.toLowerCase();
//     if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
//       cleaned[key] = '***MASKED***';
//     } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
//       cleaned[key] = maskSensitive(cleaned[key]);
//     }
//   });
//   return cleaned;
// }

const ROUTE_ENTITY_MAP: Record<string, string> = {
  '/api/v1/projects': 'Project',
  '/api/v1/tasks': 'Task',
  '/api/v1/focus-sessions': 'FocusSession',
  '/api/v1/auth': 'Auth',
  '/api/v1/users': 'User',
};

export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  let responseBody: any = null;
  const oldJson = res.json;

  res.json = function (body) {
    responseBody = body;
    return oldJson.call(this, body);
  };

  res.on('finish', async () => {
    try {
      if (res.locals.skipAuditLog) return; // Skip if controller handled it manually
      const user = (req as any).user;
      if (!user) return; // Only log authenticated actions

      const userId = user.id;
      const userEmail = user.email;
      const userName = `${user.firstName} ${user.lastName}`;

      // Simplify action: just CREATE, UPDATE, DELETE, or OTHER
      let action = 'OTHER';
      if (req.method === 'POST') action = 'CREATE';
      else if (['PUT', 'PATCH'].includes(req.method)) action = 'UPDATE';
      else if (req.method === 'DELETE') action = 'DELETE';

      // Extract entity and name for receiver
      let entity = 'System';
      for (const [prefix, ent] of Object.entries(ROUTE_ENTITY_MAP)) {
        if (req.originalUrl.startsWith(prefix)) {
          entity = ent;
          break;
        }
      }

      const entityName =
        req.body.name ??
        req.body.title ??
        responseBody?.data?.name ??
        responseBody?.data?.title ??
        responseBody?.task?.title ??
        responseBody?.name ??
        responseBody?.title;

      const entityId =
        req.params.taskId ??
        req.params.id ??
        req.body.id ??
        responseBody?.data?.id ??
        responseBody?.task?.id ??
        responseBody?.id;

      const receiver = entityName
        ? `${entity}: ${entityName}`
        : entityId
          ? `${entity} (ID: ${entityId.slice(0, 8)})`
          : entity;

      // Provide specific descriptions for task-related actions
      let description = `${action} performed on ${receiver.toLowerCase()}`;

      // Check for specific task actions
      if (req.originalUrl.includes('/claim')) {
        action = 'CREATE';
        description = `Task claimed: ${entityName || entityId?.slice(0, 8) || 'Unknown'}`;
      } else if (req.originalUrl.includes('/approve-claim')) {
        action = 'UPDATE';
        description = `Task claim approved: ${entityName || entityId?.slice(0, 8) || 'Unknown'}`;
      } else if (req.originalUrl.includes('/reject-claim')) {
        action = 'UPDATE';
        description = `Task claim rejected: ${entityName || entityId?.slice(0, 8) || 'Unknown'}`;
      }

      await prisma.log.create({
        data: {
          userId,
          action,
          description,
          userEmail,
          userName,
          actionReceiver: receiver,
          endpoint: req.originalUrl,
          ipAddress: (req.ip || req.socket.remoteAddress)?.replace(
            '::ffff:',
            '',
          ),
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log entry', {
        error,
        url: req.originalUrl,
      });
    }
  });

  next();
};
