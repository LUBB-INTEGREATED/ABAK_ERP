import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// A-21 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). The old /health was liveness-only and never touched the DB, so a
// load balancer would route to a dead-DB instance. This asserts the new
// readiness endpoint runs SELECT 1: 200 with {status:'ok',database:'up'} when
// the DB is up, and a 503 (ServiceUnavailableException) when the DB is down.

const prisma = new PrismaService();
const service = new AppService(prisma);
const controller = new AppController(service);

after(async () => {
  await prisma.$disconnect();
});

test('A-21: readiness returns ok shape when the DB is reachable', async () => {
  const res = await controller.getReadiness();
  assert.equal(res.status, 'ok', 'status is ok');
  assert.equal(res.database, 'up', 'database reported up');
  assert.ok(res.timestamp, 'timestamp present');
});

test('A-21: liveness still works and never throws', async () => {
  const res = controller.getHealth();
  assert.equal(res.status, 'ok', 'liveness ok');
  assert.ok(typeof res.uptime === 'number', 'uptime present');
});

test('A-21: readiness maps a DB failure to a 503', async () => {
  // Simulate a dead DB by pointing readiness at a Prisma stub that rejects.
  const downPrisma = {
    $queryRaw: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  } as unknown as PrismaService;
  const downService = new AppService(downPrisma);
  const downController = new AppController(downService);

  await assert.rejects(
    () => downController.getReadiness(),
    (e: unknown) => e instanceof ServiceUnavailableException,
    'a DB failure surfaces as 503 ServiceUnavailable',
  );
});
