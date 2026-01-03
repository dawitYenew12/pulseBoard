import { catchAsync } from '../utils/CatchAsync';
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as userService from '../services/user.service';
import * as authService from '../services/auth.service';
import tokenService from '../services/token.service';
import emailService from '../services/email.service';
import config from '../config/config';

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const createdUser = await userService.createUser({ email, password });

  const tokens = await tokenService.generateAuthTokens(createdUser.user);

  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: config.jwt.refreshTokenDays * 24 * 60 * 60 * 1000,
  });

  res.status(httpStatus.CREATED).json({
    message: `Sent a verification email to ${createdUser.user.email}`,
    user: createdUser.user,
    verificationToken: createdUser.verificationToken,
    tokens,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailAndPassword(email, password);

  const tokens = await tokenService.generateAuthTokens(user);

  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: config.jwt.refreshTokenDays * 24 * 60 * 60 * 1000,
  });

  res.status(httpStatus.OK).json({
    user,
    tokens,
  });
});

export const refreshAuthTokens = catchAsync(
  async (req: Request, res: Response) => {
    const encryptedRefreshToken = req.cookies.refreshToken;

    if (!encryptedRefreshToken) {
      throw new Error('Refresh token not found in cookies');
    }

    const tokens = await authService.refreshAuthTokens(encryptedRefreshToken);

    // Set the new encrypted refresh token cookie
    res.cookie('refreshToken', tokens.refresh.token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: config.jwt.refreshTokenDays * 24 * 60 * 60 * 1000,
    });

    res.status(httpStatus.OK).json({ tokens });
  },
);

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.body.token;
  await emailService.verifyEmail(token);
  res.status(httpStatus.OK).json({ message: 'Email verified successfully' });
});

export const forgotPassword = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.status(httpStatus.OK).json({
      message: 'If the email exists, a password reset link has been sent',
    });
  },
);

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  await emailService.resetPassword(token, password);
  res
    .status(httpStatus.OK)
    .json({ message: 'Password reset successfully. You can now log in.' });
});
