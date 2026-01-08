import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

function generateRandomPassword(length = 12): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]\:;?><,./-=';
  let password = '';
  // Ensure strict requirements: 1 letter, 1 number, 1 special char
  password += 'A'; // at least 1 letter
  password += '1'; // at least 1 number
  password += '!'; // at least 1 special char

  for (let i = 3; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }

  // Shuffle password
  return password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
}

async function main() {
  const superAdminEmail = 'ops@gmail.com';

  const existingUser = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (existingUser) {
    console.log(
      `Super Admin (${superAdminEmail}) already exists. Seed skipped.`,
    );
    return;
  }

  const plainPassword = generateRandomPassword();

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  console.log('Seeding superadmin user...');

  await prisma.user.create({
    data: {
      email: superAdminEmail,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPERADMIN,
      isVerified: true,
    },
  });

  console.log('-----------------------------------');
  console.log('Super Admin Created:');
  console.log(`Email:    ${superAdminEmail}`);
  console.log(`Password: ${plainPassword}`);
  console.log('-----------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
