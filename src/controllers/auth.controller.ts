import { catchAsync } from '../utils/CatchAsync';
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as userService from '../services/user.service';
import tokenService from '../services/token.service';
import emailService from '../services/email.service';

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const createdUser = await userService.createUser({ email, password });

  const tokens = await tokenService.generateAuthTokens(
    createdUser.user.id,
    createdUser.user.role,
  );
  res.status(httpStatus.CREATED).json({
    message: `Sent a verification email to ${createdUser.user.email}`,
    user: createdUser.user,
    verificationToken: createdUser.verificationToken,
    tokens,
  });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.body.token;
  await emailService.verifyEmail(token);
  res.status(httpStatus.OK).json({ message: 'Email verified successfully' });
});
