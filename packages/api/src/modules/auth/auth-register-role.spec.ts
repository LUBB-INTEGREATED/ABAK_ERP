import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto';

// A-1 (SECURITY) regression. Runs against the live dev Postgres (DATABASE_URL
// via --env-file). POST /auth/register is @Public; before the fix RegisterDto
// carried an optional `role` enum honored verbatim, so one anonymous request
// with {role:'SUPER_ADMIN'} created an ACTIVE super-admin. This proves that an
// attacker-supplied role is IGNORED and the lowest privilege is assigned.

const prisma = new PrismaService();

// Auth side-effects we don't exercise here are stubbed; only register()'s
// role-assignment is under test.
const jwt = {
  signAsync: async () => 'stub-token',
} as unknown as JwtService;
const config = {
  get: (key: string) => {
    if (key === 'auth.bcryptRounds') return 4;
    if (key === 'auth.jwtSecret') return 'test-secret';
    if (key === 'auth.jwtExpiresIn') return '15m';
    if (key === 'auth.refreshExpiresIn') return '7d';
    if (key === 'auth.refreshExpiresInDays') return 7;
    return undefined;
  },
} as unknown as ConfigService;

const service = new AuthService(prisma, jwt, config);

const emails: string[] = [];

after(async () => {
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
  await prisma.$disconnect();
});

test('A-1: register() ignores an attacker-supplied role and assigns the lowest privilege', async () => {
  const email = `a1-escalation-${Date.now()}@example.com`;
  emails.push(email);

  // A malicious client POSTs role=SUPER_ADMIN. The DTO no longer declares the
  // field, but we cast to prove that even if it reaches the service it is
  // never read.
  const dto = {
    email,
    password: 'Password123!',
    firstName: 'Mallory',
    role: UserRole.SUPER_ADMIN,
  } as RegisterDto & { role: UserRole };

  const result = await service.register(dto);

  assert.equal(
    result.user.role,
    UserRole.SALES_REPRESENTATIVE,
    'returned session must carry the safe default role, not SUPER_ADMIN',
  );

  const persisted = await prisma.user.findUnique({ where: { email } });
  assert.ok(persisted, 'user was created');
  assert.equal(
    persisted!.role,
    UserRole.SALES_REPRESENTATIVE,
    'persisted user must be the lowest-privilege role, never the attacker-chosen one',
  );
  assert.notEqual(
    persisted!.role,
    UserRole.SUPER_ADMIN,
    'register must never mint a super admin',
  );
});
