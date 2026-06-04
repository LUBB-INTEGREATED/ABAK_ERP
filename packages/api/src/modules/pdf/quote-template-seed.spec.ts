import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteSectionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// DOC-1 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). Validates the composition schema + the canonical default 8-block
// shape by upserting it (mirrors prisma/seed-price-offer.ts — kept self-contained
// so it stays inside the api tsconfig rootDir) and asserting the result.

const prisma = new PrismaService();

const TEMPLATE_ID = 'tmpl_default_8block';
const PROFILE_ID = 'company_profile_default';
const BLOCKS: QuoteSectionType[] = [
  'COVER',
  'ABOUT',
  'SCOPE_PRICING',
  'PAYMENT',
  'METHODOLOGY',
  'TIMELINE',
  'REQUIREMENTS_NOTES',
  'THANKYOU',
];

after(async () => {
  await prisma.$disconnect();
});

test('DOC-1: the default 8-block template + company profile seed cleanly', async () => {
  // Idempotent upsert (the production path is prisma/seed-price-offer.ts).
  await prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: {
      id: PROFILE_ID,
      legalName: 'ABAK Engineering Consultancy',
      services: [{ name: 'Architectural Design', nameAr: 'التصميم المعماري' }],
    },
  });
  await prisma.quoteTemplate.upsert({
    where: { id: TEMPLATE_ID },
    update: { isDefault: true, isActive: true },
    create: {
      id: TEMPLATE_ID,
      name: 'Default 8-block price offer',
      isDefault: true,
      isActive: true,
      version: 1,
      publishedAt: new Date(),
    },
  });
  await prisma.quoteTemplateSection.deleteMany({
    where: { templateId: TEMPLATE_ID },
  });
  await prisma.quoteTemplateSection.createMany({
    data: BLOCKS.map((sectionType, position) => ({
      templateId: TEMPLATE_ID,
      sectionType,
      position,
      enabled: true,
    })),
  });

  const template = await prisma.quoteTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    include: { sections: { orderBy: { position: 'asc' } } },
  });
  assert.ok(template, 'default template exists');
  assert.equal(template.isDefault, true, 'flagged as the default');
  assert.ok(template.publishedAt, 'published (snapshot-on-issue base)');
  assert.equal(template.sections.length, 8, 'has all 8 blocks');
  assert.deepEqual(
    template.sections.map((s) => s.sectionType),
    BLOCKS,
    'blocks are in the canonical order',
  );

  const profile = await prisma.companyProfile.findUnique({
    where: { id: PROFILE_ID },
  });
  assert.ok(profile, 'company profile singleton exists');
  assert.ok(profile.legalName, 'profile has a legal name');
});
