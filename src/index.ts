import express from 'express';
import http from 'http';
import cors from 'cors';
import httpStatus from 'http-status';
import config from './config/config';
import logger from './config/logger';
import { prisma } from './config/prisma'; // your Prisma instance
import { auditMiddleware } from './middlewares/audit.middleware';
// import { authMiddleware } from './middlewares/auth.middleware';
import { errorConverter, errorHandler } from './middlewares/error';
import authRoutes from './routes/auth.route';
import docsRoutes from './routes/docs.route';
import ApiError from './utils/ApiError';

// import authRoutes from './routes/auth.routes';
// import userRoutes from './routes/user.routes';
// import projectRoutes from './routes/project.routes';
// import taskRoutes from './routes/task.routes';
// import focusSessionRoutes from './routes/focus-session.routes';
// Add more routes as you create them

const app = express();

// Middleware: Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS setup (same logic as your ticketing app)
if (config.env === 'production') {
  logger.info('Production CORS enabled');
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
} else {
  logger.info('Development CORS enabled');
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );
}

// Health check
app.get('/health', (_req, res) => {
  res.status(httpStatus.OK).json({
    status: 'OK',
    environment: config.env,
    uptime: process.uptime(),
  });
});

// app.use(authMiddleware);
app.use(auditMiddleware);

// API Routes (versioned)
app.use('/api/v1/docs', docsRoutes);
app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', userRoutes);
// app.use('/api/v1/projects', projectRoutes);
// app.use('/api/v1/tasks', taskRoutes);
// app.use('/api/v1/focus-sessions', focusSessionRoutes);

// Catch 404
app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

// Graceful shutdown handler
function shutdown(server: http.Server) {
  logger.info('Received shutdown signal. Closing server...');

  server.close(async () => {
    logger.info('HTTP server closed.');

    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Database connection closed.');

    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Force shutdown: Could not close connections in time');
    process.exit(1);
  }, 10000);
}

// Unexpected error handlers
function unexpectedErrorHandler(server: http.Server) {
  return (error: Error) => {
    logger.error('Uncaught Exception / Unhandled Rejection:', error);
    shutdown(server);
  };
}

// Start server
const startServer = async () => {
  try {
    const httpServer = http.createServer(app);

    httpServer.listen(config.port, () => {
      logger.info(
        `Server running on port ${config.port} in ${config.env} mode`,
      );
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => shutdown(httpServer));
    process.on('SIGINT', () => shutdown(httpServer));

    // Catch uncaught exceptions & unhandled rejections
    process.on('uncaughtException', unexpectedErrorHandler(httpServer));
    process.on('unhandledRejection', unexpectedErrorHandler(httpServer));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
