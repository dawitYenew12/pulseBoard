import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import logger from '../config/logger';
import config from '../config/config';
import { prisma } from '../config/prisma';
import tokenService from './token.service';
import { TokenType } from '@prisma/client';
import { getTransporter, renderTemplate } from '../utils/emailTransporter';

/**
 * Send verification email to user
 */
export const sendVerificationEmail = async (
  receiverEmail: string,
  emailVerificationToken: string,
): Promise<void> => {
  try {
    const verificationUrl = `${config.env === 'production' ? 'https://yourdomain.com' : 'http://localhost:5000'}/api/v1/auth/verify-email?token=${emailVerificationToken}`;

    const templateName = 'email-verification';
    const context = {
      customName: 'User', // You can make this dynamic by passing username
      verificationUrl,
    };

    const html = await renderTemplate(templateName, context);
    const transporter = await getTransporter();

    const mailOptions = {
      from: `PulseBoard <${config.email.user}>`,
      to: receiverEmail,
      subject: 'Email Verification - PulseBoard',
      html,
    };

    await transporter.sendMail(mailOptions);

    logger.info(`Verification email sent to: ${receiverEmail}`);
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error sending verification email',
    );
  }
};

/**
 * Verify user email using verification token
 */
export const verifyEmail = async (token: string): Promise<void> => {
  if (!token) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Token is required');
  }

  try {
    // Verify the token exists in database and is valid
    const tokenDoc = await tokenService.verifyToken(
      token,
      TokenType.VERIFICATION,
    );

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: tokenDoc.userId },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if already verified
    if (user.isVerified) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
    }

    // Update user verification status
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    // Optional: Delete the verification token after successful verification
    await prisma.token.delete({
      where: { id: tokenDoc.id },
    });

    logger.info(`Email verified for user: ${user.email}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error('Error verifying email:', error);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired verification token',
    );
  }
};

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (
  userId: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  // Generate new verification token
  const verificationDoc = await tokenService.generateVerificationToken(
    user.id,
    user.role,
  );

  // Send verification email
  await sendVerificationEmail(user.email, verificationDoc.token);
};

/**
 * Send password reset email to user
 */
export const sendPasswordResetEmail = async (
  receiverEmail: string,
  resetToken: string,
): Promise<void> => {
  try {
    const resetUrl = `${config.env === 'production' ? 'https://yourdomain.com' : 'http://localhost:5000'}/api/v1/auth/reset-password?token=${resetToken}`;

    const templateName = 'password-reset';
    const context = {
      customName: 'User', // You can make this dynamic by passing username
      resetUrl,
    };

    const html = await renderTemplate(templateName, context);
    const transporter = await getTransporter();

    const mailOptions = {
      from: `PulseBoard <${config.email.user}>`,
      to: receiverEmail,
      subject: 'Password Reset Request - PulseBoard',
      html,
    };

    await transporter.sendMail(mailOptions);

    logger.info(`Password reset email sent to: ${receiverEmail}`);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error sending password reset email',
    );
  }
};

/**
 * Reset user password using reset token
 */
export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  if (!token) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Token is required');
  }

  try {
    // Verify the token exists in database and is valid
    const tokenDoc = await tokenService.verifyToken(
      token,
      TokenType.RESET_PASSWORD,
    );

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: tokenDoc.userId },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Hash the new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete the reset token after successful password reset
    await prisma.token.delete({
      where: { id: tokenDoc.id },
    });

    logger.info(`Password reset successfully for user: ${user.email}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error('Error resetting password:', error);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired reset token',
    );
  }
};

const emailService = {
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  sendPasswordResetEmail,
  resetPassword,
};

export default emailService;
