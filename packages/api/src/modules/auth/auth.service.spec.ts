import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginDto, RegisterDto } from './dto';

// A-11 (auth boundary). The auth chain — login, refresh-token rotation, and the
// register() role-pinning defense-in-depth — runs against the live dev Postgres
// (DATABASE_URL via --env-file). A REAL JwtService (not a stub) is used so token
// signing AND verification actually execute, which is what makes the rotation
// assertion meaningful (a reused, rotated-out refresh token must be rejected).

const prisma = new PrismaService();

const SECRET = 'auth-spec-secret-do-not-use-in-prod';
const jwt = new JwtService({ secret: SECRET });
const config = {
  get: (key: string) => {
    switch (key) {
      case 'auth.bcryptRounds':
        return 4; // fast hashing for tests
      case 'auth.jwtSecret':
        return SECRET;
      case 'auth.jwtExpiresIn':
        return '15m';
      case 'auth.refreshExpiresIn':
        return '7d';
      case 'auth.refreshExpiresInDays':
        return 7;
      default:
        return undefined;
    }
  },
} as unknown as ConfigService;

const service = new AuthService(prisma, jwt, config);

const TAG = `A11-AUTH-${Date.now()}`;
const emails: string[] = [];

function trackEmail(email: string) {
  emails.push(email);
  return email;
}

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

/**
 * JWT `iat`/`exp` claims have one-second granularity, so two HS256 tokens with
 * the same payload signed inside the same wall-clock second are byte-identical.
 * In production, login → refresh are seconds/minutes apart; in a tight test loop
 * they can collide. Awaiting the next epoch second before a rotation guarantees
 * a strictly-later `iat`, so the rotated refresh token is a genuinely distinct
 * string — mirroring real timing without flakiness.
 */
async function waitForNextEpochSecond(): Promise<void> {
  const startSec = Math.floor(Date.now() / 1000);
   
  while (Math.floor(Date.now() / 1000) <= startSec) {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

/** Seed an ACTIVE user with a known plaintext password via real bcrypt. */
async function seedUser(opts: {
  password: string;
  status?: UserStatus;
  role?: UserRole;
}) {
  const email = trackEmail(`${TAG}-${emails.length}@example.com`);
  const hashed = await bcrypt.hash(opts.password, 4);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      firstName: 'Auth',
      lastName: 'Spec',
      status: opts.status ?? UserStatus.ACTIVE,
      role: opts.role ?? UserRole.SALES_REPRESENTATIVE,
    },
    select: { id: true, email: true },
  });
  return user;
}

// ─── login ─────────────────────────────────────────────────────────

test('login: valid credentials → access + refresh tokens and a persisted refresh row', async () => {
  const password = 'Correct-Horse-1!';
  const user = await seedUser({ password });

  const res = await service.login({ email: user.email, password } as LoginDto);

  assert.ok(res.accessToken, 'access token issued');
  assert.ok(res.refreshToken, 'refresh token issued');
  assert.equal(res.user.email, user.email);
  // The access token verifies under the configured secret and carries the sub.
  const payload = jwt.verify<{ sub: string }>(res.accessToken, {
    secret: SECRET,
  });
  assert.equal(payload.sub, user.id);
  // The refresh token is persisted (rotation depends on it being a DB row).
  const stored = await prisma.refreshToken.findUnique({
    where: { token: res.refreshToken },
  });
  assert.ok(stored, 'refresh token persisted to the DB');
  assert.equal(stored!.userId, user.id);
});

test('login: wrong password → 401, no token row created', async () => {
  const user = await seedUser({ password: 'Right-Password-1!' });

  await assert.rejects(
    () => service.login({ email: user.email, password: 'WRONG' } as LoginDto),
    (err: unknown) => err instanceof UnauthorizedException,
  );

  const count = await prisma.refreshToken.count({ where: { userId: user.id } });
  assert.equal(count, 0, 'a failed login must not mint a refresh token');
});

test('login: unknown email → 401', async () => {
  await assert.rejects(
    () =>
      service.login({
        email: `${TAG}-nobody@example.com`,
        password: 'whatever',
      } as LoginDto),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('login: inactive account → blocked (401) even with correct password', async () => {
  const password = 'Inactive-Pass-1!';
  const user = await seedUser({ password, status: UserStatus.INACTIVE });

  await assert.rejects(
    () => service.login({ email: user.email, password } as LoginDto),
    (err: unknown) =>
      err instanceof UnauthorizedException &&
      /not active/i.test((err as Error).message),
  );

  const count = await prisma.refreshToken.count({ where: { userId: user.id } });
  assert.equal(count, 0, 'a blocked login must not mint a refresh token');
});

// ─── refreshTokens (rotation) ───────────────────────────────────────

test('refreshTokens: rotates — old token is revoked, a new pair is issued', async () => {
  const password = 'Rotate-Me-1!';
  const user = await seedUser({ password });
  const first = await service.login({
    email: user.email,
    password,
  } as LoginDto);

  await waitForNextEpochSecond();
  const rotated = await service.refreshTokens(first.refreshToken);

  assert.ok(rotated.accessToken, 'new access token issued');
  assert.ok(rotated.refreshToken, 'new refresh token issued');
  assert.notEqual(
    rotated.refreshToken,
    first.refreshToken,
    'rotation must hand back a DIFFERENT refresh token',
  );
  // Old row deleted; new row present.
  const oldRow = await prisma.refreshToken.findUnique({
    where: { token: first.refreshToken },
  });
  assert.equal(oldRow, null, 'the consumed refresh token row is deleted');
  const newRow = await prisma.refreshToken.findUnique({
    where: { token: rotated.refreshToken },
  });
  assert.ok(newRow, 'the rotated refresh token is persisted');
});

test('refreshTokens: a reused (already-rotated) refresh token is rejected (401)', async () => {
  const password = 'Reuse-Detect-1!';
  const user = await seedUser({ password });
  const first = await service.login({
    email: user.email,
    password,
  } as LoginDto);

  // Consume it once (valid rotation). Space the rotation past the epoch second
  // so the new token is a distinct string and the consumed row is truly gone.
  await waitForNextEpochSecond();
  await service.refreshTokens(first.refreshToken);

  // Replaying the same (now rotated-out) token must fail: the row is gone even
  // though the JWT signature is still valid — defeats refresh-token replay.
  await assert.rejects(
    () => service.refreshTokens(first.refreshToken),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('refreshTokens: a structurally invalid / wrong-secret token is rejected (401)', async () => {
  await assert.rejects(
    () => service.refreshTokens('not-a-real-jwt'),
    (err: unknown) =>
      err instanceof UnauthorizedException &&
      /invalid refresh token/i.test((err as Error).message),
  );
});

// ─── register: defense-in-depth role pinning (A-1 re-assert) ────────

test('register: an attacker-supplied role is ignored → SALES_REPRESENTATIVE persisted', async () => {
  const email = trackEmail(`${TAG}-escalate@example.com`);
  const dto = {
    email,
    password: 'Escalate-Me-1!',
    firstName: 'Mallory',
    role: UserRole.SUPER_ADMIN, // never read by register()
  } as RegisterDto & { role: UserRole };

  const res = await service.register(dto);

  assert.equal(
    res.user.role,
    UserRole.SALES_REPRESENTATIVE,
    'session role must be the safe default, not the attacker-chosen one',
  );
  const persisted = await prisma.user.findUnique({ where: { email } });
  assert.ok(persisted, 'user created');
  assert.equal(
    persisted!.role,
    UserRole.SALES_REPRESENTATIVE,
    'persisted role must never be the attacker-supplied SUPER_ADMIN',
  );
});
