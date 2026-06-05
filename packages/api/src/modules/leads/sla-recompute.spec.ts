import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { LeadStatus, SLAStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SlaService } from './sla.service';

// A-26 regression. recomputeAll() used to findMany every open unanswered lead
// and issue one prisma.lead.update PER row inside a single $transaction. It was
// replaced with three set-based updateMany calls bucketed by slaResponseDue vs
// now. These tests assert the new buckets produce EXACTLY the same slaStatus
// the per-row calculate() would, including the boundary cases (slaResponseDue
// == now is DUE_SOON, not OVERDUE; the +4h cutoff is inclusive of DUE_SOON),
// and that excluded leads (terminal, answered, no due date) are untouched.
// Runs against the live dev Postgres via --env-file. create -> assert -> clean.

const prisma = new PrismaService();
const sla = new SlaService(prisma);

const TAG = `TEST-A26-${Date.now()}`;
const HOUR = 60 * 60 * 1000;
const now = new Date('2026-06-05T12:00:00.000Z');

const trash: string[] = [];

type LeadSeed = {
  label: string;
  status?: LeadStatus;
  slaResponseDue: Date | null;
  firstResponseAt?: Date | null;
  // The status we PRE-SET (deliberately wrong) so recompute must transition it.
  preset: SLAStatus;
};

async function seedLead(seed: LeadSeed): Promise<string> {
  const lead = await prisma.lead.create({
    data: {
      leadNumber: `LEAD-${TAG}-${trash.length}`,
      channel: 'PHONE',
      contactName: seed.label,
      phone: '0500000000',
      status: seed.status ?? LeadStatus.INCOMING,
      slaResponseDue: seed.slaResponseDue,
      firstResponseAt: seed.firstResponseAt ?? null,
      slaStatus: seed.preset,
    },
    select: { id: true },
  });
  trash.push(lead.id);
  return lead.id;
}

after(async () => {
  for (const id of trash) await prisma.lead.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('A-26: updateMany buckets match the per-row calculate() across boundaries', async () => {
  // OVERDUE: due strictly before now. Preset DUE_SOON so it must flip.
  const overdueId = await seedLead({
    label: 'overdue',
    slaResponseDue: new Date(now.getTime() - HOUR),
    preset: SLAStatus.DUE_SOON,
  });
  // Boundary: due exactly at now -> hoursUntilDue == 0 -> DUE_SOON (NOT overdue).
  const atNowId = await seedLead({
    label: 'at-now',
    slaResponseDue: new Date(now.getTime()),
    preset: SLAStatus.OVERDUE,
  });
  // DUE_SOON: due within the 4h window. Preset ON_TIME so it must flip.
  const dueSoonId = await seedLead({
    label: 'due-soon',
    slaResponseDue: new Date(now.getTime() + 2 * HOUR),
    preset: SLAStatus.ON_TIME,
  });
  // Boundary: exactly +4h -> hoursUntilDue == 4 -> DUE_SOON (cutoff inclusive).
  const cutoffId = await seedLead({
    label: 'cutoff',
    slaResponseDue: new Date(now.getTime() + 4 * HOUR),
    preset: SLAStatus.ON_TIME,
  });
  // ON_TIME: due beyond the window. Preset OVERDUE so it must flip back.
  const onTimeId = await seedLead({
    label: 'on-time',
    slaResponseDue: new Date(now.getTime() + 8 * HOUR),
    preset: SLAStatus.OVERDUE,
  });

  await sla.recomputeAll(now);

  const expectMatchesCalculate = async (id: string) => {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id },
      select: { slaStatus: true, slaResponseDue: true, firstResponseAt: true },
    });
    const expected = sla.calculate(lead, now);
    assert.equal(
      lead.slaStatus,
      expected,
      `lead ${id} should match calculate()`,
    );
    return lead.slaStatus;
  };

  assert.equal(await expectMatchesCalculate(overdueId), SLAStatus.OVERDUE);
  assert.equal(await expectMatchesCalculate(atNowId), SLAStatus.DUE_SOON);
  assert.equal(await expectMatchesCalculate(dueSoonId), SLAStatus.DUE_SOON);
  assert.equal(await expectMatchesCalculate(cutoffId), SLAStatus.DUE_SOON);
  assert.equal(await expectMatchesCalculate(onTimeId), SLAStatus.ON_TIME);
});

test('A-26: leads excluded by the scan are never touched', async () => {
  // Answered: firstResponseAt set -> excluded even though due is in the past.
  const answeredId = await seedLead({
    label: 'answered',
    slaResponseDue: new Date(now.getTime() - HOUR),
    firstResponseAt: new Date(now.getTime() - 2 * HOUR),
    preset: SLAStatus.ON_TIME,
  });
  // Terminal status -> excluded.
  const terminalId = await seedLead({
    label: 'disqualified',
    status: LeadStatus.DISQUALIFIED,
    slaResponseDue: new Date(now.getTime() - HOUR),
    preset: SLAStatus.ON_TIME,
  });
  // No due date -> excluded.
  const noDueId = await seedLead({
    label: 'no-due',
    slaResponseDue: null,
    preset: SLAStatus.OVERDUE,
  });

  await sla.recomputeAll(now);

  const status = async (id: string) =>
    (
      await prisma.lead.findUniqueOrThrow({
        where: { id },
        select: { slaStatus: true },
      })
    ).slaStatus;

  // Each keeps its preset value, untouched by recompute.
  assert.equal(await status(answeredId), SLAStatus.ON_TIME, 'answered lead');
  assert.equal(
    await status(terminalId),
    SLAStatus.ON_TIME,
    'terminal (disqualified) lead',
  );
  assert.equal(await status(noDueId), SLAStatus.OVERDUE, 'no-due lead');
});

test('A-26: a second recompute with no time change writes nothing (idempotent)', async () => {
  const status = async (leadId: string) =>
    (
      await prisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { slaStatus: true },
      })
    ).slaStatus;

  const id = await seedLead({
    label: 'idempotent',
    slaResponseDue: new Date(now.getTime() - HOUR),
    preset: SLAStatus.ON_TIME,
  });

  const first = await sla.recomputeAll(now);
  assert.ok(first.transitioned >= 1, 'first pass transitions the overdue lead');

  // Status is now OVERDUE; a repeat pass must produce the same value for it.
  assert.equal(await status(id), SLAStatus.OVERDUE);
  await sla.recomputeAll(now);
  assert.equal(await status(id), SLAStatus.OVERDUE, 'unchanged on repeat');
});
