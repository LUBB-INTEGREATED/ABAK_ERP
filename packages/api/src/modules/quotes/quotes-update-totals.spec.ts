import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DiscountType, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';

// RVd-1 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). update() must recompute taxAmount/discountAmount/totalAmount on
// ANY pricing-affecting change — not only when items are resent. The divergent
// path: a DRAFT quote (items 30,000 / fixed discount 3,000 / taxRate 15 →
// total 31,050) gets PATCHed with {taxRate:5} ONLY (no items). Pre-fix this
// wrote taxRate=5 but left the stale 15%-derived taxAmount=4,050/total=31,050,
// so the client document printed "VAT (5%)=4,050" and did not reconcile.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new QuotesService(prisma, notifications, pricingPolicy, audit);

const TAG = `TEST-RVD1-${Date.now()}`;
const trash = { quoteIds: [] as string[], clientIds: [] as string[] };

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('RVd-1: a taxRate-only PATCH recomputes taxAmount + totalAmount (no stale totals)', async () => {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}`,
      contactName: 'RVd-1 Totals Test',
      phone: '0500000001',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);

  // Create a DRAFT quote via the service so create()'s calculateTotals runs:
  // items 30,000, fixed discount 3,000, taxRate 15 → afterDiscount 27,000,
  // VAT 4,050, total 31,050.
  const created = await service.create(
    {
      clientId: c.id,
      title: 'RVd-1 totals reconciliation',
      discountType: DiscountType.FIXED,
      discountValue: 3000,
      taxRate: 15,
      items: [
        {
          description: 'Single line',
          quantity: 1,
          unitPrice: 30000,
        },
      ],
    } as never,
    undefined,
  );
  trash.quoteIds.push(created.id);

  assert.equal(created.status, QuoteStatus.DRAFT, 'created as DRAFT');
  assert.equal(created.subtotal, 30000, 'subtotal = 30,000');
  assert.equal(created.discountAmount, 3000, 'discount = 3,000 (fixed)');
  assert.equal(created.taxRate, 15, 'taxRate = 15 at create');
  assert.equal(created.taxAmount, 4050, 'VAT = 4,050 at 15%');
  assert.equal(created.totalAmount, 31050, 'total = 31,050 at 15%');

  // The divergent PATCH: change ONLY the tax rate, do NOT resend items.
  const updated = await service.update(created.id, { taxRate: 5 } as never);

  // Post-fix the amounts must follow the new rate and reconcile.
  assert.equal(updated.taxRate, 5, 'taxRate written = 5');
  assert.equal(
    updated.taxAmount,
    1350,
    'VAT recomputed to 1,350 (5% of 27,000) — NOT the stale 4,050',
  );
  assert.equal(
    updated.totalAmount,
    28350,
    'total recomputed to 28,350 — NOT the stale 31,050',
  );
  assert.equal(updated.subtotal, 30000, 'subtotal unchanged');
  assert.equal(updated.discountAmount, 3000, 'discount unchanged');
  // The band must internally reconcile: subtotal − discount + VAT === total.
  assert.equal(
    updated.subtotal - updated.discountAmount + updated.taxAmount,
    updated.totalAmount,
    'subtotal − discount + VAT === total after the taxRate-only PATCH',
  );
});
