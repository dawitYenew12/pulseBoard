import nodemailer, { Transporter } from 'nodemailer';
import config from '../config/config';
import { google } from 'googleapis';
import path from 'path';
import { create as createHandlebars } from 'express-handlebars';
import fs from 'fs';
import logger from '../config/logger';
import ApiError from './ApiError';
import httpStatus from 'http-status';

const hbs = createHandlebars({
  layoutsDir: path.join(__dirname, '..', 'templates', 'layouts'),
  defaultLayout: 'main',
  extname: '.hbs',
});

const oauth2Client = new google.auth.OAuth2(
  config.email.clientId,
  config.email.clientSecret,
  config.email.redirectUri,
);

oauth2Client.setCredentials({ refresh_token: config.email.refreshToken });

/**
 * Get OAuth2 access token
 */
const getAccessToken = async (): Promise<string> => {
  try {
    const accessTokenResponse = await oauth2Client.getAccessToken();
    if (!accessTokenResponse.token) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to retrieve access token',
      );
    }
    return accessTokenResponse.token;
  } catch (error) {
    logger.error('Error getting access token:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error getting access token',
    );
  }
};

/**
 * Create email transporter with OAuth2
 */
const createTransporter = async (): Promise<Transporter> => {
  const accessToken = await getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: config.email.user,
      clientId: config.email.clientId,
      clientSecret: config.email.clientSecret,
      refreshToken: config.email.refreshToken,
      accessToken: accessToken,
    },
  });
};

/**
 * Render Handlebars email template with layout
 */
export const renderTemplate = async (
  templateName: string,
  context: Record<string, any>,
): Promise<string> => {
  const templatePath = path.join(
    __dirname,
    '..',
    'templates',
    `${templateName}.hbs`,
  );

  const layoutPath = path.join(
    __dirname,
    '..',
    'templates',
    'layouts',
    'main.hbs',
  );

  try {
    // Read the template and layout
    const templateContent = await fs.promises.readFile(templatePath, 'utf8');
    const layoutContent = await fs.promises.readFile(layoutPath, 'utf8');

    // Compile and render the template
    const compiledTemplate = hbs.handlebars.compile(templateContent, {});
    const renderedBody = compiledTemplate(context);

    // Compile and render the layout with the body
    const compiledLayout = hbs.handlebars.compile(layoutContent, {});
    const renderedHtml = compiledLayout({ body: renderedBody });

    return renderedHtml;
  } catch (error) {
    logger.error(
      `Error reading the template file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error rendering email template',
    );
  }
};

/**
 * Get or create transporter instance
 */
export const getTransporter = async (): Promise<Transporter> => {
  return await createTransporter();
};

export default { renderTemplate, getTransporter };
