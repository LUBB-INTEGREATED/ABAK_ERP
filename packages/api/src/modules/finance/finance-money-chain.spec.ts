import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import {
  ConfirmationType,
  InvoiceStatus,
  POStatus,
  PaymentMethod,
  PaymentValidationStatus,
  ProjectStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from './finance.service';

// A-23 (finance money chain — coverage). The finance money chain was untested:
// PO mint, payment-driven Invoice/PO status flips, the AT_RISK set/clear, the
// project closure gate, and the broker-commission ACCRUING -> APPROVED -> PAID
// state machine. These specs run the real FinanceService against the live dev
// Postgres (create -> assert -> cleanup) and pin each money transition. This is
// COVERAGE — finance.service.ts logic is not modified.

const prisma = new PrismaService();
const audit = { log: async () => undefined } as unknown as AuditService;
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const service = new FinanceService(prisma, audit, notifications);

const TAG = `A23-${Date.now()}`;

// validatedById / finalPaymentReceivedById / financialRisk actor columns are
// FK'd to User, so the acting finance officer must be a REAL seeded user — not
// a synthetic string. Memoized so every test in the file shares one actor.
let actorIdCache: string | undefined;

const trash = {
  paymentIds: [] as string[],
  invoiceIds: [] as string[],
  closureProjectIds: [] as string[],
  projectIds: [] as string[],
  poIds: [] as string[],
  confirmationIds: [] as string[],
  commissionIds: [] as string[],
  rfqIds: [] as string[],
  oppIds: [] as string[],
  quoteIds: [] as string[],
  clientIds: [] as string[],
  userIds: [] as string[],
};

after(async () => {
  for (const id of trash.paymentIds)
    await prisma.payment.deleteMany({ where: { id } });
  for (const id of trash.invoiceIds)
    await prisma.invoice.deleteMany({ where: { id } });
  for (const id of trash.closureProjectIds)
    await prisma.closureChecklist.deleteMany({ where: { projectId: id } });
  for (const id of trash.projectIds)
    await prisma.project.deleteMany({ where: { id } });
  for (const id of trash.poIds)
    await prisma.purchaseOrder.deleteMany({ where: { id } });
  for (const id of trash.confirmationIds)
    await prisma.commercialConfirmation.deleteMany({ where: { id } });
  for (const id of trash.commissionIds)
    await prisma.commission.deleteMany({ where: { id } });
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

let seq = 0;
function uniq() {
  return `${TAG}-${seq++}`;
}

/** Lazily seed (once) and return a real finance-officer user id for FK columns. */
async function actor(): Promise<string> {
  if (actorIdCache) return actorIdCache;
  const user = await prisma.user.create({
    data: {
      email: `${uniq()}-actor@example.com`,
      password: 'x',
      firstName: 'Finance',
      lastName: 'Officer',
      role: UserRole.FINANCE_MANAGER,
    },
    select: { id: true },
  });
  trash.userIds.push(user.id);
  actorIdCache = user.id;
  return actorIdCache;
}

async function seedClient() {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${uniq()}`,
      contactName: 'Finance Chain',
      phone: '0500000000',
    },
    select: { id: true, lifetimeValue: true },
  });
  trash.clientIds.push(client.id);
  return client;
}

async function seedConfirmation(contractValue: number) {
  const client = await seedClient();
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${uniq()}`,
      clientId: client.id,
      title: 'Finance chain quote',
      subtotal: contractValue,
      totalAmount: contractValue,
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const conf = await prisma.commercialConfirmation.create({
    data: {
      quoteId: quote.id,
      type: ConfirmationType.PO,
      contractValue,
      validationStatus: PaymentValidationStatus.PENDING,
    },
    select: { id: true },
  });
  trash.confirmationIds.push(conf.id);
  return { confirmationId: conf.id, clientId: client.id, quoteId: quote.id };
}

async function seedPM() {
  const user = await prisma.user.create({
    data: {
      email: `${uniq()}@example.com`,
      password: 'x',
      firstName: 'Project',
      lastName: 'Manager',
      // Project.pmId is just a User FK; any role satisfies it. TECHNICAL_MANAGER
      // is the closest fit (there is no dedicated PROJECT_MANAGER role).
      role: UserRole.TECHNICAL_MANAGER,
    },
    select: { id: true },
  });
  trash.userIds.push(user.id);
  return user.id;
}

/** Seed a PO + (optionally) Project + ClosureChecklist for payment-chain tests. */
async function seedPo(
  contractValue: number,
  opts: { withProject?: boolean; actualProgress?: number } = {},
) {
  const client = await seedClient();
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${uniq()}`,
      clientId: client.id,
      title: 'PO quote',
      subtotal: contractValue,
      totalAmount: contractValue,
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: `PO-${uniq()}`,
      quoteId: quote.id,
      clientId: client.id,
      contractValue,
      status: POStatus.ACTIVE,
    },
    select: { id: true, clientId: true },
  });
  trash.poIds.push(po.id);

  let projectId: string | undefined;
  if (opts.withProject) {
    const pmId = await seedPM();
    const project = await prisma.project.create({
      data: {
        projectNumber: `PRJ-${uniq()}`,
        poId: po.id,
        clientId: client.id,
        title: 'Chain project',
        pmId,
        contractValue,
        actualProgress: opts.actualProgress ?? 0,
        status: ProjectStatus.ACTIVE,
      },
      select: { id: true },
    });
    trash.projectIds.push(project.id);
    projectId = project.id;
    await prisma.closureChecklist.create({
      data: { projectId: project.id, initiatedById: await actor() },
    });
    trash.closureProjectIds.push(project.id);
  }
  return { poId: po.id, clientId: po.clientId, projectId };
}

async function seedInvoice(poId: string, clientId: string, total: number) {
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${uniq()}`,
      poId,
      clientId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal: total,
      taxAmount: 0,
      totalAmount: total,
      status: InvoiceStatus.ISSUED,
    },
    select: { id: true },
  });
  trash.invoiceIds.push(invoice.id);
  return invoice.id;
}

async function recordValidatedPayment(opts: {
  poId: string;
  invoiceId?: string;
  amount: number;
}) {
  const payment = await service.recordPayment(
    {
      poId: opts.poId,
      invoiceId: opts.invoiceId,
      amount: opts.amount,
      method: PaymentMethod.BANK_TRANSFER,
      receivedAt: new Date().toISOString(),
    },
    await actor(),
  );
  trash.paymentIds.push(payment.id);
  await service.validatePayment(
    payment.id,
    { status: PaymentValidationStatus.VALIDATED, note: 'validated-ok' },
    await actor(),
  );
  return payment.id;
}

// ─── PO mint (once, not double) ─────────────────────────────────────

test('A-23: validating a commercial confirmation mints exactly ONE PO and bumps client LTV', async () => {
  const CONTRACT = 120000;
  const { confirmationId, clientId, quoteId } =
    await seedConfirmation(CONTRACT);

  await service.validateCommercialConfirmation(
    confirmationId,
    { status: PaymentValidationStatus.VALIDATED, note: 'minted' },
    await actor(),
  );

  const pos = await prisma.purchaseOrder.findMany({ where: { quoteId } });
  pos.forEach((p) => trash.poIds.push(p.id));
  assert.equal(pos.length, 1, 'exactly one PO minted on validation');
  assert.equal(
    pos[0].contractValue,
    CONTRACT,
    'PO contract value = confirmation',
  );
  assert.equal(pos[0].status, POStatus.ACTIVE, 'minted PO is ACTIVE');

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  assert.equal(
    client!.lifetimeValue,
    CONTRACT,
    'client LTV bumped by contract value',
  );
});

test('A-23: re-validating an already-decided confirmation throws — no double PO', async () => {
  const CONTRACT = 80000;
  const { confirmationId, quoteId } = await seedConfirmation(CONTRACT);

  await service.validateCommercialConfirmation(
    confirmationId,
    { status: PaymentValidationStatus.VALIDATED, note: 'first' },
    await actor(),
  );
  const after1 = await prisma.purchaseOrder.findMany({ where: { quoteId } });
  after1.forEach((p) => trash.poIds.push(p.id));

  const actorId = await actor();
  await assert.rejects(
    () =>
      service.validateCommercialConfirmation(
        confirmationId,
        { status: PaymentValidationStatus.VALIDATED, note: 'again' },
        actorId,
      ),
    BadRequestException,
  );

  const after2 = await prisma.purchaseOrder.findMany({ where: { quoteId } });
  assert.equal(
    after2.length,
    1,
    'still exactly one PO after a re-validate attempt',
  );
});

test('A-23: a REJECTED confirmation mints no PO', async () => {
  const { confirmationId, quoteId } = await seedConfirmation(50000);
  await service.validateCommercialConfirmation(
    confirmationId,
    { status: PaymentValidationStatus.REJECTED, note: 'rejected-reason' },
    await actor(),
  );
  const pos = await prisma.purchaseOrder.findMany({ where: { quoteId } });
  pos.forEach((p) => trash.poIds.push(p.id));
  assert.equal(pos.length, 0, 'a rejected confirmation mints no PO');
});

// ─── Invoice / PO status flips only at/above contract value ─────────

test('A-23: a partial payment → Invoice PARTIALLY_PAID, PO stays ACTIVE', async () => {
  const CONTRACT = 100000;
  const { poId, clientId } = await seedPo(CONTRACT);
  const invoiceId = await seedInvoice(poId, clientId, CONTRACT);

  await recordValidatedPayment({ poId, invoiceId, amount: 40000 });

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert.equal(
    invoice!.status,
    InvoiceStatus.PARTIALLY_PAID,
    'a partial payment marks the invoice PARTIALLY_PAID, not PAID',
  );
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  assert.equal(
    po!.status,
    POStatus.ACTIVE,
    'PO stays ACTIVE below the contract value',
  );
});

test('A-23: cumulative payments at/above contract value → Invoice PAID, PO COMPLETED', async () => {
  const CONTRACT = 100000;
  const { poId, clientId } = await seedPo(CONTRACT);
  const invoiceId = await seedInvoice(poId, clientId, CONTRACT);

  await recordValidatedPayment({ poId, invoiceId, amount: 60000 });
  await recordValidatedPayment({ poId, invoiceId, amount: 40000 });

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert.equal(
    invoice!.status,
    InvoiceStatus.PAID,
    'cumulative validated payments covering the invoice flip it to PAID',
  );
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  assert.equal(
    po!.status,
    POStatus.COMPLETED,
    'PO flips to COMPLETED once collected covers the contract value',
  );
});

// ─── AT_RISK set and clear + closure gate ───────────────────────────

test('A-23: AT_RISK sets when progress outruns cash, then CLEARS when cash catches up; closure gate flips', async () => {
  const CONTRACT = 100000;
  // Project is 80% executed but nothing collected yet → execution outruns cash.
  const { poId, projectId } = await seedPo(CONTRACT, {
    withProject: true,
    actualProgress: 80,
  });
  assert.ok(projectId, 'project seeded');

  // First (partial) validated payment of 50k: progress value (80k) still
  // exceeds collected (50k) → AT_RISK is set.
  await recordValidatedPayment({ poId, amount: 50000 });
  let project = await prisma.project.findUnique({ where: { id: projectId } });
  assert.equal(
    project!.status,
    ProjectStatus.AT_RISK,
    'execution ahead of collected cash flips the project AT_RISK',
  );
  assert.equal(project!.financialRiskFlagged, true, 'risk flag set');
  assert.ok(project!.financialRiskFlaggedAt, 'risk flagged timestamp stamped');

  // Second validated payment of 50k: collected (100k) now >= progress value
  // (80k) AND >= contract value → AT_RISK clears to ACTIVE, closure gate flips.
  await recordValidatedPayment({ poId, amount: 50000 });
  project = await prisma.project.findUnique({ where: { id: projectId } });
  assert.equal(
    project!.status,
    ProjectStatus.ACTIVE,
    'once cash catches up the project clears back to ACTIVE',
  );
  assert.equal(project!.financialRiskFlagged, false, 'risk flag cleared');
  assert.equal(project!.financialRiskReason, null, 'risk reason cleared');

  const closure = await prisma.closureChecklist.findUnique({
    where: { projectId },
  });
  assert.equal(
    closure!.finalPaymentReceived,
    true,
    'collecting the full contract value flips the closure gate finalPaymentReceived',
  );
  assert.ok(
    closure!.finalPaymentReceivedAt,
    'closure final-payment timestamp stamped',
  );
});

// ─── Payment validation guard ───────────────────────────────────────

test('A-23: re-validating an already-validated payment throws', async () => {
  const CONTRACT = 30000;
  const { poId } = await seedPo(CONTRACT);
  const payment = await service.recordPayment(
    {
      poId,
      amount: 10000,
      method: PaymentMethod.CASH,
      receivedAt: new Date().toISOString(),
    },
    await actor(),
  );
  trash.paymentIds.push(payment.id);
  const actorId = await actor();
  await service.validatePayment(
    payment.id,
    { status: PaymentValidationStatus.VALIDATED, note: 'first-pass' },
    actorId,
  );
  await assert.rejects(
    () =>
      service.validatePayment(
        payment.id,
        { status: PaymentValidationStatus.VALIDATED, note: 'second-pass' },
        actorId,
      ),
    BadRequestException,
  );
});

// ─── Broker commission: ACCRUING -> APPROVED -> PAID ────────────────

async function seedCommission(status: 'ACCRUING' | 'APPROVED' | 'PAID') {
  const client = await seedClient();
  const opp = await prisma.pipelineEntry.create({
    data: { clientId: client.id },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${uniq()}`,
      opportunityId: opp.id,
      clientId: client.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'BROKER',
      brokerName: 'Broker Pay',
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);
  const commission = await prisma.commission.create({
    data: {
      rfqId: rfq.id,
      beneficiaryType: 'BROKER',
      beneficiaryName: 'Broker Pay',
      baseAmount: 100000,
      rate: 3,
      amount: 3000,
      status,
    },
    select: { id: true },
  });
  trash.commissionIds.push(commission.id);
  return commission.id;
}

test('A-23: commission approve requires ACCRUING then pay requires APPROVED (happy path)', async () => {
  const id = await seedCommission('ACCRUING');

  const approved = await service.approveCommission(id, await actor());
  assert.equal(approved.status, 'APPROVED', 'ACCRUING -> APPROVED');

  const paid = await service.markCommissionPaid(
    id,
    { paidAt: new Date().toISOString(), paymentReference: 'REF-1' },
    await actor(),
  );
  assert.equal(paid.status, 'PAID', 'APPROVED -> PAID');
  assert.ok(paid.paidAt, 'paidAt stamped');
});

test('A-23: approving a non-ACCRUING commission throws', async () => {
  const id = await seedCommission('APPROVED');
  const actorId = await actor();
  await assert.rejects(
    () => service.approveCommission(id, actorId),
    BadRequestException,
  );
});

test('A-23: marking a non-APPROVED commission PAID throws (cannot skip approval)', async () => {
  const id = await seedCommission('ACCRUING');
  const actorId = await actor();
  await assert.rejects(
    () =>
      service.markCommissionPaid(
        id,
        { paidAt: new Date().toISOString() },
        actorId,
      ),
    BadRequestException,
  );
});
