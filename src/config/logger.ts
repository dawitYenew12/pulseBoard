import winston, { Logger } from 'winston';
const { format, createLogger, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
import config from './config';

interface Config {
  env: string;
}

const configTyped: Config = config;

const winstonFormat = printf(
  ({ level, message, timestamp, stack }: winston.Logform.TransformableInfo) => {
    return `${timestamp}: ${level}: ${stack || message}`;
  },
);

const logger: Logger = createLogger({
  level: configTyped.env === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp(),
    configTyped.env === 'production'
      ? winstonFormat
      : combine(colorize(), winstonFormat),
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format:
        configTyped.env === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), winston.format.simple()),
    }),
  ],
});

export default logger;
