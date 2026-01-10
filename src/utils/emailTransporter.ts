import { google } from 'googleapis';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Base64 } from 'js-base64';
import logger from '../config/logger';
import config from '../config/config';

const OAuth2 = google.auth.OAuth2;

/**
 * Create OAuth2 client
 */
const createOAuth2Client = () => {
  const oauth2Client = new OAuth2(
    config.email.clientId,
    config.email.clientSecret,
    config.email.redirectUri,
  );

  oauth2Client.setCredentials({
    refresh_token: config.email.refreshToken,
  });

  return oauth2Client;
};

/**
 * Render email template using Handlebars
 */
export const renderTemplate = async (
  templateName: string,
  context: Record<string, any>,
): Promise<string> => {
  try {
    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      `${templateName}.hbs`,
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    return template(context);
  } catch (error) {
    logger.error(`Error rendering template ${templateName}:`, error);
    throw new Error(`Failed to render email template: ${templateName}`);
  }
};

/**
 * Construct email message in RFC 2822 format
 */
const createEmailBody = (
  to: string,
  from: string,
  subject: string,
  message: string,
) => {
  const str = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    message,
  ].join('\n');

  return Base64.encodeURI(str);
};

/**
 * Send email using Gmail API
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  htmlContent: string,
): Promise<void> => {
  try {
    const oauth2Client = createOAuth2Client();

    // We need to refresh the token to ensure we have a valid access token
    // technically the client handles this but explicit check is good
    // However, googleapis does this automatically on request if refresh token is present.

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const recipient = Array.isArray(to) ? to.join(',') : to;

    // Create the raw email body
    const raw = createEmailBody(
      recipient,
      `PulseBoard <${config.email.user}>`,
      subject,
      htmlContent,
    );

    const match = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });

    logger.info(`Email sent via Gmail API. Id: ${match.data.id}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Failed to send email via Gmail API');
  }
};

export default {
  renderTemplate,
  sendEmail,
};
