import { User } from '@prisma/client';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import { UserBody } from '../types/user.types';
import bcrypt from 'bcryptjs';
import tokenService from './token.service';
import { sendVerificationEmail } from './email.service';

export const isEmailTaken = async (email: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return !!user;
};

export const createUser = async (
  userBody: UserBody,
): Promise<{ user: User; verificationToken: string }> => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'User with this email already exists',
    );
  }
  const { email, password } = userBody;
  const result = await prisma.$transaction(async (tx) => {
    // hash password and create user
    const hashedPassword = await bcrypt.hash(password, 8);
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const verificationDoc = await tokenService.generateVerificationToken(
      user.id,
      user.role,
      tx,
    );

    return { user, verificationToken: verificationDoc.token };
  });

  await sendVerificationEmail(result.user.email, result.verificationToken);

  return result;
};
