import winston, { Logger } from 'winston';
const { format, createLogger, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
import config from './config';

interface Config {
  env: string;
}

const configTyped: Config = config;

const winstonFormat = printf(
  ({
    level,
    message,
    timestamp,
    stack,
    ...metadata
  }: winston.Logform.TransformableInfo) => {
    const metaStr =
      metadata && Object.keys(metadata).length
        ? `\n${JSON.stringify(metadata, null, 2)}`
        : '';
    return `${timestamp}: ${level}: ${stack || message}${metaStr}`;
  },
);

const logger: Logger = createLogger({
  level: configTyped.env === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), format.errors({ stack: true })),
  transports: [
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winstonFormat,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      format: winstonFormat,
    }),
    new transports.Console({
      format:
        configTyped.env === 'production'
          ? combine(json())
          : combine(colorize(), winstonFormat),
    }),
  ],
});

export default logger;
