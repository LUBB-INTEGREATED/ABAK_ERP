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

// RVd-9/RVd-10: PARSE the money() strings the renderer actually emits so the
// reconciliation properties are asserted against the printed document, not the
// input literals. money() => formatCurrency(n,{locale:'ar',numerals:'latin'})
// => "<grouped 2dp number> <SAR>" — and the SAR symbol differs by runtime
// (Arabic "ر.س" under tsx, Latin "SAR" under the swc-node test runner). The
// parser is therefore SYMBOL-AGNOSTIC: it strips everything except the leading
// signed grouped decimal, so it works under BOTH runners.
function parseMoney(token: string): number {
  // Keep only the numeric part: leading optional minus, digits, commas, dot.
  const m = /-?[\d,]+\.\d{2}/.exec(token);
  assert.ok(m, `parseMoney failed on: ${JSON.stringify(token)}`);
  const n = Number(m![0].replace(/,/g, ''));
  assert.ok(Number.isFinite(n), `parseMoney NaN on: ${JSON.stringify(token)}`);
  return n;
}

// Extract the inner HTML of the FIRST <table class="…matching…">…</table>.
function tableHtml(html: string, classNeedle: string): string {
  const re = new RegExp(
    `<table class="[^"]*${classNeedle}[^"]*">([\\s\\S]*?)</table>`,
  );
  const m = re.exec(html);
  assert.ok(m, `table matching "${classNeedle}" not found`);
  return m![1];
}

// Every money value printed in <td class="n">…</td> cells of a table fragment.
// A money cell is a "n" cell whose content is a 2dp decimal and is NOT a percent
// cell (so qty cells like "10" and percentage cells like "33.33%" are excluded).
const MONEY_CELL =
  /<td class="n">((?:(?!%)[^<])*?-?[\d,]+\.\d{2}(?:(?!%)[^<])*?)<\/td>/g;
function moneyCellsOf(fragment: string): number[] {
  return [...fragment.matchAll(MONEY_CELL)].map((c) => parseMoney(c[1]));
}

// The LAST money cell of each <tr> — i.e. the rightmost "الإجمالي" column on a
// dept pricing page (where each row also prints a unit-price money cell).
function lastMoneyCellPerRow(fragment: string): number[] {
  const rows = [...fragment.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  return rows
    .map((r) => {
      const cells = [...r[1].matchAll(MONEY_CELL)];
      return cells.length ? parseMoney(cells[cells.length - 1][1]) : null;
    })
    .filter((v): v is number => v !== null);
}

// The total-band rows (المجموع الفرعي / VAT / grand) live in <div class="row">.
function bandValue(html: string, label: string): number {
  const re = new RegExp(
    `<span>${label}[^<]*</span><span class="n">([^<]*?-?[\\d,]+\\.\\d{2}[^<]*?)</span>`,
  );
  const m = re.exec(html);
  assert.ok(m, `band row "${label}" not found`);
  return parseMoney(m![1]);
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

// ------------------------------------------------------------------
// RVd-9..10 — the reconciliation properties that actually failed before the fix:
// PARSE the emitted money() strings and assert columns sum to the printed total.
// ------------------------------------------------------------------

// Two single-item depts whose STORED subtotals carry 3 decimals (33.335 each).
// Pre-fix each printed cell rounds independently (33.34 + 33.34 = 66.68) while
// the printed المجموع الفرعي prints 66.67 → off by 0.01. The renderer residual
// allocation must make the printed dept column sum EXACTLY to the printed
// subtotal. (Models a legacy row stored before the write-time rounding.)
function threeDecimalQuote(): LoadedQuote {
  const q = multiDeptQuote();
  // Design dept: one item @ 33.335; Supervision dept: one item @ 33.335.
  q.items = [
    item({
      description: 'Design line',
      sectionId: 'secA',
      departmentId: 'catA',
      quantity: 1,
      unitPrice: 33.335,
      subtotal: 33.335,
    }),
    item({
      description: 'Supervision line',
      sectionId: 'secB',
      departmentId: 'catB',
      quantity: 1,
      unitPrice: 33.335,
      subtotal: 33.335,
    }),
  ] as LoadedQuote['items'];
  // raw subtotal 66.67; no discount; 15% VAT = 10.0005 → 10.00; total 76.67.
  (q as { subtotal: number }).subtotal = 66.67;
  (q as { discountAmount: number }).discountAmount = 0;
  (q as { taxAmount: number }).taxAmount = 10.0;
  (q as { totalAmount: number }).totalAmount = 76.67;
  (q as { paymentMilestones: unknown[] }).paymentMilestones = [];
  return q;
}

test('RVd-9: printed dept subtotals sum EXACTLY to the printed المجموع الفرعي (3-decimal inputs)', () => {
  const quote = threeDecimalQuote();
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);

  // The summary table on the totals page: one money cell per department.
  const summary = tableHtml(html, 'summary');
  const printedDeptSubtotals = moneyCellsOf(summary);
  assert.equal(printedDeptSubtotals.length, 2, 'one summary row per dept');

  const printedSubtotalLine = bandValue(html, 'المجموع الفرعي');
  const sumOfRows = round2(
    printedDeptSubtotals.reduce((s, v) => round2(s + v), 0),
  );
  assert.equal(
    sumOfRows,
    printedSubtotalLine,
    `Σ(printed dept subtotals)=${sumOfRows} must equal printed المجموع الفرعي=${printedSubtotalLine}`,
  );
  // And the printed subtotal is the 2dp figure (66.67), proving the residual was
  // absorbed (33.34 + 33.33 = 66.67), not naively rounded (33.34 + 33.34).
  assert.equal(printedSubtotalLine, 66.67, 'printed subtotal is 66.67');
});

test('RVd-9: per-line الإجمالي cells sum EXACTLY to the printed إجمالي القسم', () => {
  // One dept, three items each storing 11.115 → raw dept total 33.345 → 33.34
  // (2dp). Pre-fix the three printed cells (11.12 each = 33.36) overshoot the
  // printed dept subtotal. Residual allocation must reconcile.
  const quote = multiDeptQuote();
  quote.items = [
    item({
      description: 'L1',
      sectionId: 'secA',
      departmentId: 'catA',
      quantity: 1,
      unitPrice: 11.115,
      subtotal: 11.115,
    }),
    item({
      description: 'L2',
      sectionId: 'secA',
      departmentId: 'catA',
      quantity: 1,
      unitPrice: 11.115,
      subtotal: 11.115,
    }),
    item({
      description: 'L3',
      sectionId: 'secA',
      departmentId: 'catA',
      quantity: 1,
      unitPrice: 11.115,
      subtotal: 11.115,
    }),
  ] as LoadedQuote['items'];
  (quote as { departmentSections: unknown[] }).departmentSections = [
    {
      id: 'secA',
      departmentId: 'catA',
      isLead: true,
      status: 'SUBMITTED_TO_LEAD',
      pricerId: null,
      scopeTextAr: null,
      scopeTextEn: null,
      pricingModel: 'LUMP_SUM',
      department: { id: 'catA', name: 'Design', nameAr: 'التصميم', order: 1 },
    },
  ];
  (quote as { subtotal: number }).subtotal = 33.34;
  (quote as { discountAmount: number }).discountAmount = 0;
  (quote as { taxAmount: number }).taxAmount = 5.0;
  (quote as { totalAmount: number }).totalAmount = 38.34;
  (quote as { paymentMilestones: unknown[] }).paymentMilestones = [];

  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);
  // The dept page is the FIRST quote-table that is NOT the summary table; each
  // row prints a unit-price money cell AND a subtotal cell — we want the last
  // (الإجمالي) per row.
  const deptTable = tableHtml(html, 'quote-table');
  const lineCells = lastMoneyCellPerRow(deptTable);
  assert.equal(lineCells.length, 3, 'three line cells');
  const sumLines = round2(lineCells.reduce((s, v) => round2(s + v), 0));

  // The printed إجمالي القسم value (symbol-agnostic capture).
  const deptSubMatch =
    /قبل الضريبة\)<\/span>\s*<span class="n">([^<]+)<\/span>/.exec(html);
  assert.ok(deptSubMatch, 'dept subtotal line present');
  const printedDeptSub = parseMoney(deptSubMatch![1]);
  assert.equal(
    sumLines,
    printedDeptSub,
    `Σ(printed line cells)=${sumLines} must equal printed إجمالي القسم=${printedDeptSub}`,
  );
});

test('RVd-10: milestone amounts sum EXACTLY to the printed grand total (33.33/33.33/33.34)', () => {
  const quote = multiDeptQuote();
  // 33.33/33.33/33.34 of 31050. The NAIVE per-row split (pct/100*31050 each
  // independently rounded) is [10348.97, 10348.97, 10352.07] = 31050.01 — 0.01
  // OVER the grand total. The service stores the penny-reconciled amounts (last
  // milestone absorbs the residual): [10348.97, 10348.97, 10352.06] = 31050.00.
  // The renderer prints these STORED amounts, so the column reconciles exactly.
  (quote as { paymentMilestones: unknown[] }).paymentMilestones = [
    {
      id: 'pm1',
      description: 'On signing',
      percentage: 33.33,
      amount: 10348.97,
      daysFromStart: null,
      notes: null,
      position: 0,
    },
    {
      id: 'pm2',
      description: 'Midway',
      percentage: 33.33,
      amount: 10348.97,
      daysFromStart: null,
      notes: null,
      position: 1,
    },
    {
      id: 'pm3',
      description: 'On delivery',
      percentage: 33.34,
      amount: 10352.06,
      daysFromStart: null,
      notes: null,
      position: 2,
    },
  ];
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);

  // The payment table is the one preceded by "جدول الدفعات".
  const paymentSection = html.slice(html.indexOf('جدول الدفعات'));
  const paymentTable = tableHtml(paymentSection, 'quote-table');
  const amounts = moneyCellsOf(paymentTable);
  assert.equal(amounts.length, 3, 'three milestone amount cells');
  const sumAmounts = round2(amounts.reduce((s, v) => round2(s + v), 0));
  assert.equal(
    sumAmounts,
    quote.totalAmount,
    `Σ(printed milestone amounts)=${sumAmounts} must equal grand total=${quote.totalAmount}`,
  );
});

test('RVd-10: milestone residual is absorbed even when stored amounts are stale (legacy rows)', () => {
  // Legacy: stored amounts are the naive pct*total (each independently rounded,
  // column 0.01 short). The renderer must STILL reconcile the printed column to
  // the grand total via its residual safety-net.
  const quote = multiDeptQuote();
  // Naive per-row amounts (each independently rounded) sum to 31050.01 — 0.01
  // OVER the grand total. The renderer's residual safety-net must still print a
  // column that sums to 31050.00 exactly.
  (quote as { paymentMilestones: unknown[] }).paymentMilestones = [
    {
      id: 'pm1',
      description: 'A',
      percentage: 33.33,
      amount: 10348.97,
      daysFromStart: null,
      notes: null,
      position: 0,
    },
    {
      id: 'pm2',
      description: 'B',
      percentage: 33.33,
      amount: 10348.97,
      daysFromStart: null,
      notes: null,
      position: 1,
    },
    {
      id: 'pm3',
      description: 'C',
      percentage: 33.34,
      amount: 10352.07,
      daysFromStart: null,
      notes: null,
      position: 2,
    },
  ];
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);
  const paymentSection = html.slice(html.indexOf('جدول الدفعات'));
  const amounts = moneyCellsOf(tableHtml(paymentSection, 'quote-table'));
  const sumAmounts = round2(amounts.reduce((s, v) => round2(s + v), 0));
  assert.equal(
    sumAmounts,
    quote.totalAmount,
    'renderer residual safety-net reconciles even a stale legacy milestone column',
  );
});

// ------------------------------------------------------------------
// RVd-12 — PER_VISIT caption: a per-visit dept gets visit-specific column labels.
// ------------------------------------------------------------------
test('RVd-12: a PER_VISIT section labels qty/unit-price columns as visits', () => {
  const quote = multiDeptQuote();
  // Mark the Supervision section PER_VISIT.
  (quote.departmentSections[1] as { pricingModel: string }).pricingModel =
    'PER_VISIT';
  const html = renderQuoteDocument(quote, EIGHT_BLOCKS);
  assert.ok(html.includes('عدد الزيارات'), 'visit-count column header present');
  assert.ok(
    html.includes('سعر الزيارة'),
    'per-visit price column header present',
  );
  // The lump-sum Design dept keeps the generic labels.
  assert.ok(
    html.includes('سعر الوحدة'),
    'lump-sum dept keeps generic unit price',
  );
});

// ------------------------------------------------------------------
// RVd-11 — render-level XSS: EVERY user-controlled field is escaped on BOTH the
// live path AND the as-issued renderManifest path.
// ------------------------------------------------------------------
const XSS = '<img src=x onerror=alert(1)>';

function xssQuote(): LoadedQuote {
  const q = multiDeptQuote();
  (q as { title: string }).title = XSS;
  // client + company names
  (q.client as { companyName: string }).companyName = XSS;
  // section scope text (ar) + methodology + milestone description + requirement
  (q.departmentSections[0] as { scopeTextAr: string }).scopeTextAr = XSS;
  q.items[0].description = XSS;
  (q.items[0].methodologyCard as { description: string }).description = XSS;
  (q.items[0].methodologyCard as { steps: string[] }).steps = [XSS];
  (q.items[0].methodologyCard as { deliverable: string }).deliverable = XSS;
  (q.items[0] as { notes: string | null }).notes = XSS;
  q.paymentMilestones[0].description = XSS;
  q.requirements[0].text = XSS;
  return q;
}

function xssCompany() {
  return {
    legalName: XSS,
    aboutText: XSS,
    services: [{ name: XSS, nameAr: XSS }],
    accreditations: [XSS],
    phone: XSS,
    email: XSS,
    website: XSS,
    address: XSS,
    logoUrl: XSS,
    bank: {
      bankName: XSS,
      bankAccountName: XSS,
      iban: XSS,
      swift: XSS,
    },
  };
}

test('RVd-11: every user field is escaped on the LIVE render path (no raw <img)', () => {
  const quote = xssQuote();
  const ctx: DocContext = {
    asIssued: false,
    company: xssCompany(),
    blocks: EIGHT_BLOCKS.blocks,
  };
  const html = renderQuoteDocument(quote, ctx);
  assert.ok(
    !html.includes('<img src=x onerror'),
    'no raw <img onerror payload survives — every field is esc()-escaped',
  );
  // The escaped form must be present (proves the marker round-tripped, escaped).
  assert.ok(
    html.includes('&lt;img src=x onerror=alert(1)&gt;'),
    'the marker appears in its escaped form',
  );
});

test('RVd-11: every user field is escaped on the as-issued MANIFEST render path', () => {
  const quote = xssQuote();
  // asIssued path: company comes from the snapshot, blocks from the manifest.
  const ctx: DocContext = {
    asIssued: true,
    company: xssCompany(),
    blocks: EIGHT_BLOCKS.blocks,
  };
  const html = renderQuoteDocument(quote, ctx);
  assert.ok(
    !html.includes('<img src=x onerror'),
    'no raw <img onerror payload survives on the manifest path either',
  );
  assert.ok(
    html.includes('&lt;img src=x onerror=alert(1)&gt;'),
    'escaped marker present on the manifest path',
  );
});
