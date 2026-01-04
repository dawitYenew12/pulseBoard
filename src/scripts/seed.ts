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
  const plainPassword = generateRandomPassword();

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  console.log('Seeding superadmin user...');

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {}, // Don't overwrite if it exists
    create: {
      email: superAdminEmail,
      password: hashedPassword,
      role: Role.SUPERADMIN,
      isVerified: true,
    },
  });

  if (superAdmin.createdAt.getTime() === superAdmin.updatedAt.getTime()) {
    console.log('-----------------------------------');
    console.log('Super Admin Created:');
    console.log(`Email:    ${superAdminEmail}`);
    console.log(`Password: ${plainPassword}`);
    console.log('-----------------------------------');
  } else {
    console.log(`Super Admin (${superAdminEmail}) already exists.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
