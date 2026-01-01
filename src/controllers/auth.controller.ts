import { catchAsync } from '../utils/CatchAsync';
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as userService from '../services/user.service';
import tokenService from '../services/token.service';

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const createdUser = await userService.createUser({ email, password });

  const tokens = await tokenService.generateAuthTokens(
    createdUser.id,
    createdUser.role,
  );
  res.status(httpStatus.CREATED).json({
    message: `Sent a verification email to ${createdUser.email}`,
    user: createdUser,
    tokens,
  });
});
