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

function maskSensitive(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(maskSensitive);

  const cleaned = { ...data };
  Object.keys(cleaned).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
      cleaned[key] = '***MASKED***';
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = maskSensitive(cleaned[key]);
    }
  });
  return cleaned;
}

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
      const userId = (req as any).user?.id ?? null;

      // Detect entity from route
      let entity = 'System';
      let entityId: string | undefined = undefined;

      for (const [prefix, ent] of Object.entries(ROUTE_ENTITY_MAP)) {
        if (req.originalUrl.startsWith(prefix)) {
          entity = ent;
          entityId =
            req.params.id ??
            req.body.id ??
            responseBody?.data?.id ??
            responseBody?.id;
          break;
        }
      }

      // Derive action
      const methodAction =
        {
          POST: 'CREATE',
          PUT: 'UPDATE',
          PATCH: 'UPDATE',
          DELETE: 'DELETE',
        }[req.method] || req.method;

      const action = `${entity.toUpperCase()}_${methodAction}`;

      const verb =
        methodAction === 'CREATE'
          ? 'Created'
          : methodAction === 'UPDATE'
            ? 'Updated'
            : methodAction === 'DELETE'
              ? 'Deleted'
              : methodAction;

      const message = `${verb} ${entity.toLowerCase()}${entityId ? ` (${entityId.slice(0, 8)}...)` : ''}`;

      await prisma.log.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          message,
          ip: (req.ip || req.socket.remoteAddress)?.replace('::ffff:', ''),
          userAgent: req.get('User-Agent'),
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
