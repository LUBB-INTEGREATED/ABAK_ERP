import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  type DocContext,
  type LoadedQuote,
  renderQuoteDocument,
} from './quote-document.renderer';

// DOC-3 regression — the review-gate core: the combined-totals math + the
// multi-department fan-out. A pure-function test (no DB) so the totals rule is
// pinned: per-department blocks show ONLY a pre-VAT line subtotal; discount +
// VAT + grand total appear ONCE; the numbers add up.

function item(over: Record<string, unknown>) {
  return {
    id: Math.random().toString(36).slice(2),
    serviceId: null,
    departmentId: null,
    department: null,
    description: 'Line',
    quantity: 1,
    unit: null,
    unitPrice: 0,
    discountPct: 0,
    subtotal: 0,
    notes: null,
    position: 0,
    sectionId: null,
    methodologyCard: null,
    ganttBlock: null,
    ...over,
  } as unknown as LoadedQuote['items'][number];
}

const EIGHT_BLOCKS: DocContext = {
  asIssued: false,
  company: {
    legalName: 'ABAK Engineering Consultancy',
    aboutText: 'About ABAK.',
    services: [{ name: 'Design', nameAr: 'تصميم' }],
    accreditations: [],
    phone: '+966',
    email: 'info@abak.com.sa',
    website: 'abak.com.sa',
    address: 'Riyadh',
    bank: {
      bankName: 'Bank',
      bankAccountName: 'ABAK',
      iban: 'SA123',
      swift: null,
    },
  },
  blocks: [
    'COVER',
    'ABOUT',
    'SCOPE_PRICING',
    'PAYMENT',
    'METHODOLOGY',
    'TIMELINE',
    'REQUIREMENTS_NOTES',
    'THANKYOU',
  ].map((sectionType, position) => ({ sectionType, enabled: true, position })),
};

// A multi-department quote: Design (lead, 20,000) + Supervision (co, 10,000).
// subtotal 30,000 − discount 3,000 + VAT 4,050 = total 31,050.
function multiDeptQuote(): LoadedQuote {
  return {
    id: 'q1',
    quoteNumber: 'QUO-TEST-0001',
    title: 'Multi-dept project',
    status: 'APPROVED',
    sentAt: null,
    createdAt: new Date('2026-06-01'),
    subtotal: 30000,
    discountAmount: 3000,
    taxRate: 15,
    taxAmount: 4050,
    totalAmount: 31050,
    renderManifest: null,
    client: {
      id: 'c1',
      clientNumber: 'CLI-1',
      contactName: 'Client',
      companyName: 'Client Co',
    },
    departmentSections: [
      {
        id: 'secA',
        departmentId: 'catA',
        isLead: true,
        status: 'SUBMITTED_TO_LEAD',
        pricerId: null,
        scopeTextAr: 'نطاق التصميم',
        scopeTextEn: null,
        department: { id: 'catA', name: 'Design', nameAr: 'التصميم', order: 1 },
      },
      {
        id: 'secB',
        departmentId: 'catB',
        isLead: false,
        status: 'SUBMITTED_TO_LEAD',
        pricerId: null,
        scopeTextAr: null,
        scopeTextEn: null,
        department: {
          id: 'catB',
          name: 'Supervision',
          nameAr: 'الإشراف',
          order: 2,
        },
      },
    ],
    items: [
      item({
        description: 'Architectural design',
        sectionId: 'secA',
        departmentId: 'catA',
        quantity: 1,
        unitPrice: 20000,
        subtotal: 20000,
        methodologyCard: {
          id: 'm1',
          description: 'Design methodology',
          steps: ['Survey', 'Draft', 'Finalize'],
          deliverable: 'Stamped drawings',
        },
        ganttBlock: {
          id: 'g1',
          startDay: 0,
          durationDays: 30,
          categoryTone: '#000',
        },
      }),
      item({
        description: 'Site supervision',
        sectionId: 'secB',
        departmentId: 'catB',
        quantity: 10,
        unit: 'زيارة',
        unitPrice: 1000,
        subtotal: 10000,
      }),
    ],
    paymentMilestones: [
      {
        id: 'pm1',
        description: 'On signing',
        percentage: 50,
        amount: 15525,
        daysFromStart: null,
        notes: null,
        position: 0,
      },
      {
        id: 'pm2',
        description: 'On delivery',
        percentage: 50,
        amount: 15525,
        daysFromStart: null,
        notes: null,
        position: 1,
      },
    ],
    requirements: [
      {
        id: 'r1',
        quoteId: 'q1',
        type: 'DOCUMENT',
        text: 'Commercial registration',
        isShared: true,
        dedupedFromIds: [],
        position: 0,
      },
    ],
    approvals: [],
    purchaseOrder: null,
  } as unknown as LoadedQuote;
}

const countOf = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

test('DOC-3: the combined totals band adds up and there is NO per-dept VAT', () => {
  const quote = multiDeptQuote();
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);

  // The data the band renders must reconcile.
  assert.equal(
    quote.subtotal - quote.discountAmount + quote.taxAmount,
    quote.totalAmount,
    'subtotal − discount + VAT === grand total',
  );
  assert.equal(
    20000 + 10000,
    quote.subtotal,
    'dept line subtotals sum to the quote subtotal',
  );

  // Blocker #2: VAT appears exactly ONCE (the combined band), never per-dept.
  assert.equal(
    countOf(html, 'ضريبة القيمة المضافة'),
    1,
    'VAT line appears exactly once (no per-department VAT)',
  );
  // One pre-VAT "department subtotal" per section.
  assert.equal(
    countOf(html, 'إجمالي القسم (قبل الضريبة)'),
    2,
    'a pre-VAT line subtotal per department',
  );
});

test('DOC-3: multi-department fan-out + all 8 blocks render', () => {
  const quote = multiDeptQuote();
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);

  assert.ok(html.includes('التصميم'), 'lead department (Design) rendered');
  assert.ok(html.includes('الإشراف'), 'co department (Supervision) rendered');
  assert.ok(html.includes('القسم الرئيسي'), 'lead badge on the lead section');
  // Lead section comes before the co-pricer section.
  assert.ok(
    html.indexOf('التصميم') < html.indexOf('الإشراف'),
    'lead department renders first',
  );

  assert.ok(html.includes('فقط:'), 'amount-in-words present');
  assert.ok(html.includes('من نحن'), 'about block');
  assert.ok(html.includes('جدول الدفعات'), 'payment block');
  assert.ok(html.includes('منهجية'), 'methodology block');
  assert.ok(html.includes('الجدول الزمني'), 'timeline block');
  assert.ok(
    html.includes('المستندات المطلوبة'),
    'requirements block (documents)',
  );
  assert.ok(html.includes('شكراً'), 'thank-you block');
  assert.ok(html.includes('IBAN: SA123'), 'bank details on the thank-you page');

  // At least 8 printed pages (cover, about, 2 scope pages + totals, payment,
  // methodology, timeline, requirements, thanks).
  assert.ok(countOf(html, 'class="page') >= 8, 'at least 8 page blocks');
});

test('RVd-1: a reconciling quote shows NO inconsistent-totals banner', () => {
  const quote = multiDeptQuote();
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);
  assert.equal(
    countOf(html, 'class="totals-warning"'),
    0,
    'no DRAFT banner when subtotal − discount + VAT === total',
  );
  assert.ok(
    !html.includes('totals inconsistent'),
    'no inconsistency text on a clean quote',
  );
});

test('RVd-1: renderer safety-net stamps a DRAFT banner when totals diverge', () => {
  // The exact RVd-1 stale-state: a {taxRate:5}-only PATCH would write taxRate=5
  // but (pre-fix) leave the 15%-derived taxAmount=4050/total=31050. The renderer
  // must NOT silently print that — it must loudly flag the divergence.
  const quote = multiDeptQuote();
  (quote as { taxRate: number }).taxRate = 5; // printed "VAT (5%)"
  // taxAmount (4050) + total (31050) still reflect the old 15% rate → stale.
  // subtotal 30000 − discount 3000 + VAT 4050 = 31050 happens to reconcile with
  // the STALE numbers, so force the genuine divergence the bug produces: the
  // amounts no longer satisfy subtotal − discount + tax === total once the rate
  // moved. Model the post-fix-absent state where only taxAmount stayed stale.
  (quote as { taxAmount: number }).taxAmount = 1350; // correct 5% VAT
  // total left at the stale 31050 → subtotal−discount+VAT (28350) ≠ 31050.
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);
  assert.equal(
    countOf(html, 'class="totals-warning"'),
    1,
    'DRAFT banner stamped exactly once when totals do not reconcile',
  );
  assert.ok(
    html.includes('totals inconsistent'),
    'visible inconsistency message present',
  );
});

test('DOC-3: legacy quote (no sections, null sectionId) still renders', () => {
  const quote = multiDeptQuote();
  // Strip the §14 sections + sectionIds → pre-DM-3 shape.
  (quote as { departmentSections: unknown[] }).departmentSections = [];
  for (const it of quote.items)
    (it as { sectionId: string | null }).sectionId = null;
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);

  assert.ok(html.includes('QUO-TEST-0001'), 'renders the quote');
  assert.equal(
    countOf(html, 'ضريبة القيمة المضافة'),
    1,
    'still exactly one VAT line on the legacy fallback',
  );
  assert.ok(html.includes('Architectural design'), 'legacy items rendered');
});
