import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BadRequestException,
  type ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

// A-19 regression. The only previous global filter caught HttpException, so any
// non-HTTP error fell through to Nest's default handler — a leaked stack trace
// and an inconsistent envelope. The catch-all filter must map known Prisma
// codes to clean statuses and everything else to a generic 500 with the SAME
// envelope shape, and must NEVER put a stack trace in the response body. Pure
// unit tests with a stubbed host — no app boot.

// Silence the server-side error log so the test output stays clean.
Logger.overrideLogger(false);

type CapturedResponse = {
  statusCode?: number;
  body?: Record<string, unknown>;
};

function makeHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = {};
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
  };
  const request = { url: '/api/v1/things', method: 'POST' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

const filter = new AllExceptionsFilter();

function assertEnvelopeShape(body: Record<string, unknown> | undefined) {
  assert.ok(body, 'a response body was written');
  for (const key of ['statusCode', 'timestamp', 'path', 'method', 'message']) {
    assert.ok(key in body!, `envelope has "${key}"`);
  }
  assert.equal(body!.path, '/api/v1/things');
  assert.equal(body!.method, 'POST');
}

test('A-19: a thrown non-HTTP error yields a generic 500 with no stack in the body', () => {
  const { host, captured } = makeHost();
  const boom = new Error('postgres exploded: secret connection string here');
  filter.catch(boom, host);

  assert.equal(captured.statusCode, 500);
  assertEnvelopeShape(captured.body);
  assert.equal(captured.body!.message, 'Internal server error');
  // The real error message and stack must never reach the client.
  const serialized = JSON.stringify(captured.body);
  assert.ok(!serialized.includes('postgres exploded'), 'real message leaked');
  assert.ok(!serialized.includes('secret connection'), 'real detail leaked');
  assert.ok(!('stack' in captured.body!), 'no stack key in body');
});

test('A-19: Prisma P2002 (unique) maps to 409 Conflict', () => {
  const { host, captured } = makeHost();
  const err = new Prisma.PrismaClientKnownRequestError('Unique failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
  filter.catch(err, host);

  assert.equal(captured.statusCode, 409);
  assertEnvelopeShape(captured.body);
  assert.equal(captured.body!.error, 'Conflict');
});

test('A-19: Prisma P2025 (not found) maps to 404 Not Found', () => {
  const { host, captured } = makeHost();
  const err = new Prisma.PrismaClientKnownRequestError('Not found', {
    code: 'P2025',
    clientVersion: 'test',
  });
  filter.catch(err, host);

  assert.equal(captured.statusCode, 404);
  assertEnvelopeShape(captured.body);
  assert.equal(captured.body!.error, 'Not Found');
});

test('A-19: Prisma P2003 (FK) maps to 400 Bad Request', () => {
  const { host, captured } = makeHost();
  const err = new Prisma.PrismaClientKnownRequestError('FK failed', {
    code: 'P2003',
    clientVersion: 'test',
  });
  filter.catch(err, host);

  assert.equal(captured.statusCode, 400);
  assertEnvelopeShape(captured.body);
});

test('A-19: an unmapped Prisma code falls back to a generic 500', () => {
  const { host, captured } = makeHost();
  const err = new Prisma.PrismaClientKnownRequestError('Some DB issue', {
    code: 'P2010',
    clientVersion: 'test',
  });
  filter.catch(err, host);

  assert.equal(captured.statusCode, 500);
  assert.equal(captured.body!.message, 'Internal server error');
});

test('A-19: an HttpException reaching the catch-all keeps its status and envelope', () => {
  const { host, captured } = makeHost();
  filter.catch(new BadRequestException('bad input'), host);

  assert.equal(captured.statusCode, 400);
  assertEnvelopeShape(captured.body);
  assert.equal(captured.body!.message, 'bad input');
});
