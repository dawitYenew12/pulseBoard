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
  '/api/projects': 'Project',
  '/api/tasks': 'Task',
  '/api/focus-sessions': 'FocusSession',
  '/api/auth': 'Auth',
  '/api/users': 'User',
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
        responseBody?.name ??
        responseBody?.title;

      const entityId =
        req.params.id ??
        req.body.id ??
        responseBody?.data?.id ??
        responseBody?.id;

      const receiver = entityName
        ? `${entity}: ${entityName}`
        : entityId
          ? `${entity} (ID: ${entityId.slice(0, 8)})`
          : entity;

      const description = `${action} performed on ${receiver.toLowerCase()}`;

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
