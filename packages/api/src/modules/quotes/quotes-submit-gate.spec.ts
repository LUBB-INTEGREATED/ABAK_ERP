import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { QuoteSectionStatus, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import type { SubmitQuoteDto } from './dto';

// DM-15e regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). The §14 submit gate: a quote can only be submitted for approval
// once every department section is SUBMITTED_TO_LEAD, and only by the lead
// section's pricer.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const service = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `TEST-DM15E-${Date.now()}`;
const trash = {
  quoteIds: [] as string[],
  clientIds: [] as string[],
  userIds: [] as string[],
};

async function seedUser(label: string, role?: 'ADMIN'): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${trash.userIds.length}@example.com`,
      password: 'x',
      firstName: label,
      status: 'ACTIVE',
      ...(role ? { role } : {}),
    },
    select: { id: true },
  });
  trash.userIds.push(u.id);
  return u.id;
}

async function twoCategories(): Promise<[string, string]> {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 2,
  });
  if (cats.length < 2) throw new Error('need two ServiceCategory rows');
  return [cats[0].id, cats[1].id];
}

/**
 * Seed a fully-priced, milestone-complete two-section quote at the given section
 * status. catA is the lead (pricer engLead); catB the co-section (engB).
 */
async function seedSectionedQuote(status: QuoteSectionStatus) {
  const [catA, catB] = await twoCategories();
  const engLead = await seedUser('lead');
  const engB = await seedUser('co');

  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Submit Gate Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Submit gate',
      status: QuoteStatus.DRAFT,
      subtotal: 2000,
      totalAmount: 2000,
      paymentMilestones: {
        create: [
          { description: 'Full', percentage: 100, amount: 2000, position: 0 },
        ],
      },
      departmentSections: {
        create: [
          { departmentId: catA, isLead: true, pricerId: engLead, status },
          { departmentId: catB, isLead: false, pricerId: engB, status },
        ],
      },
      items: {
        create: [
          {
            departmentId: catA,
            description: 'A',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            position: 0,
          },
          {
            departmentId: catB,
            description: 'B',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            position: 1,
          },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  return { quoteId: quote.id, engLead, engB };
}

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-15e: submit is blocked while a section is still DRAFT (not submitted to lead)', async () => {
  const { quoteId, engLead } = await seedSectionedQuote(
    QuoteSectionStatus.DRAFT,
  );
  await assert.rejects(
    () =>
      service.submit(quoteId, {} as SubmitQuoteDto, { user: { id: engLead } }),
    /submitted to the lead/i,
    'a DRAFT section blocks submit even when fully priced',
  );
});

test('DM-15e: only the lead reviewer can submit (all sections submitted)', async () => {
  const { quoteId, engB } = await seedSectionedQuote(
    QuoteSectionStatus.SUBMITTED_TO_LEAD,
  );
  await assert.rejects(
    () => service.submit(quoteId, {} as SubmitQuoteDto, { user: { id: engB } }),
    (e: unknown) => e instanceof ForbiddenException,
    'a co-pricer (not the lead) cannot submit the offer',
  );
});

test('RV3-1: a manual / auto-sectioned quote (DRAFT section, no lead) still submits', async () => {
  // Mirrors syncItemSections on a manual quote: a section exists per item
  // department but with isLead=false, pricerId=null, status DRAFT. The §14 gate
  // must NOT fire (no lead reviewer) — it falls through to the normal checks.
  await seedUser('approver', 'ADMIN');
  const [catA] = await twoCategories();
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Manual Quote',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Manual',
      status: QuoteStatus.DRAFT,
      subtotal: 1000,
      totalAmount: 1000,
      paymentMilestones: {
        create: [
          { description: 'Full', percentage: 100, amount: 1000, position: 0 },
        ],
      },
      // Auto-section shape: DRAFT, not lead, no pricer.
      departmentSections: { create: [{ departmentId: catA }] },
      items: {
        create: [
          {
            departmentId: catA,
            description: 'A',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            position: 0,
          },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);

  const submitted = await service.submit(quote.id, {} as SubmitQuoteDto, {
    user: { id: await seedUser('manual-submitter') },
  });
  assert.equal(
    submitted.status,
    QuoteStatus.PENDING_APPROVAL,
    'manual quote with a non-lead DRAFT section submits normally',
  );
});

test('DM-15e: the lead submits once every section is SUBMITTED_TO_LEAD', async () => {
  // Guarantee an approver exists for tiers 1 & 2 (ADMIN satisfies both).
  await seedUser('approver', 'ADMIN');
  const { quoteId, engLead } = await seedSectionedQuote(
    QuoteSectionStatus.SUBMITTED_TO_LEAD,
  );

  const submitted = await service.submit(quoteId, {} as SubmitQuoteDto, {
    user: { id: engLead },
  });
  assert.equal(
    submitted.status,
    QuoteStatus.PENDING_APPROVAL,
    'lead submit advances the quote to PENDING_APPROVAL',
  );
  assert.ok(
    submitted.approvals.length >= 2,
    'approval tiers were created (BR-07: tier 1 + tier 2)',
  );
});
