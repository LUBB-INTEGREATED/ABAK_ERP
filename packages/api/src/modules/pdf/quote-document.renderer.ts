import { amountInWords, formatCurrency, formatNumber } from 'shared-utils';
import type { QuotesService } from '../quotes/quotes.service';

// DOC-3: the price-offer document renderer. Pure function: a loaded quote + a
// resolved document context (template blocks + company content) → the full
// 8-block A4 HTML string. Consumed by QuotePdfService (PDF) and the print route.
//
// THE CRITICAL RULE (price-offer blocker #2): per-department blocks show ONLY a
// pre-discount, pre-VAT LINE SUBTOTAL. The discount + 15% VAT + grand total
// appear ONCE on a combined band. There is NO per-department VAT anywhere.

export type LoadedQuote = Awaited<ReturnType<QuotesService['findOne']>>;

export interface DocBlock {
  sectionType: string;
  enabled: boolean;
  position: number;
}

export interface DocCompany {
  legalName?: string | null;
  legalNameAr?: string | null;
  aboutText?: string | null;
  aboutTextAr?: string | null;
  services?: unknown;
  accreditations?: unknown;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  addressAr?: string | null;
  logoUrl?: string | null;
  bank?: {
    bankName?: string | null;
    bankAccountName?: string | null;
    iban?: string | null;
    swift?: string | null;
  } | null;
}

export interface DocContext {
  blocks: DocBlock[];
  company: DocCompany | null;
  /** True when the context was restored from a sent quote's renderManifest. */
  asIssued: boolean;
}

const money = (n: number) =>
  formatCurrency(n, { locale: 'ar', numerals: 'latin' });
const num = (n: number) =>
  formatNumber(n, { numerals: 'latin', grouping: false });

// RVd-3..7 (rounding cluster, display half): the renderer's single rounding
// policy. round2 mirrors the service's write-time policy; allocateResidual takes
// already-rounded child values and a 2dp parent total and pushes any sub-cent
// difference onto the LAST child, so every printed column reconciles to the
// printed parent EXACTLY — even for a legacy quote whose stored rows predate the
// write-time rounding (e.g. two depts each stored 100.005 → printed 100.01 +
// 100.00 = 200.01 === printed subtotal, not 100.01 + 100.01 = 200.02).
const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

function allocateResidual(children: number[], parent: number): number[] {
  if (children.length === 0) return [];
  const rounded = children.map(round2);
  const allButLast = rounded
    .slice(0, -1)
    .reduce((sum, v) => round2(sum + v), 0);
  rounded[rounded.length - 1] = round2(round2(parent) - allButLast);
  return rounded;
}

export const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      (
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }) as Record<string, string>
      )[c] ?? c,
  );

const nameOf = (x: unknown): string => {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') {
    const o = x as { nameAr?: string; name?: string };
    return o.nameAr ?? o.name ?? '';
  }
  return '';
};

// ------------------------------------------------------------------
// Section grouping (§14): group items by QuoteDepartmentSection, lead-first.
// Legacy fallback (pre-DM-3, null sectionId): group by departmentId.
// ------------------------------------------------------------------

interface RenderSection {
  key: string;
  deptName: string;
  isLead: boolean;
  scopeText: string | null;
  items: LoadedQuote['items'];
  /** pre-discount, pre-VAT line subtotal (blocker #2). */
  lineSubtotal: number;
  /** RVd-12: LUMP_SUM | PER_VISIT | PER_UNIT — drives per-visit captions. */
  pricingModel: string;
  legacy: boolean;
}

function resolveSections(quote: LoadedQuote): {
  sections: RenderSection[];
  hadNullSectionId: boolean;
} {
  const hadNullSectionId = quote.items.some((it) => !it.sectionId);

  if (quote.departmentSections.length > 0) {
    const ordered = [...quote.departmentSections].sort(
      (a, b) =>
        (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0) ||
        (a.department?.order ?? 0) - (b.department?.order ?? 0),
    );
    const sections = ordered.map((s): RenderSection => {
      const items = quote.items.filter(
        (it) =>
          it.sectionId === s.id ||
          (!it.sectionId && it.departmentId === s.departmentId),
      );
      return {
        key: s.id,
        deptName: s.department?.nameAr ?? s.department?.name ?? '—',
        isLead: s.isLead,
        scopeText: s.scopeTextAr ?? s.scopeTextEn ?? null,
        items,
        lineSubtotal: items.reduce((sum, it) => sum + it.subtotal, 0),
        pricingModel:
          (s as { pricingModel?: string }).pricingModel ?? 'LUMP_SUM',
        legacy: false,
      };
    });
    // Items not matched to any section (defensive) → an "other" bucket.
    const matched = new Set(sections.flatMap((s) => s.items.map((i) => i.id)));
    const leftovers = quote.items.filter((it) => !matched.has(it.id));
    if (leftovers.length) {
      sections.push({
        key: 'other',
        deptName: 'أخرى',
        isLead: false,
        scopeText: null,
        items: leftovers,
        lineSubtotal: leftovers.reduce((sum, it) => sum + it.subtotal, 0),
        pricingModel: 'LUMP_SUM',
        legacy: true,
      });
    }
    return { sections, hadNullSectionId };
  }

  // Legacy fallback: group by departmentId (or one flat section).
  const byDept = new Map<string, LoadedQuote['items']>();
  for (const it of quote.items) {
    const key = it.departmentId ?? '__flat__';
    const arr = byDept.get(key) ?? [];
    arr.push(it);
    byDept.set(key, arr);
  }
  const sections = [...byDept.entries()].map(
    ([key, items]): RenderSection => ({
      key,
      deptName:
        items[0]?.department?.nameAr ??
        items[0]?.department?.name ??
        'بنود العرض',
      isLead: false,
      scopeText: null,
      items,
      lineSubtotal: items.reduce((sum, it) => sum + it.subtotal, 0),
      pricingModel: 'LUMP_SUM',
      legacy: true,
    }),
  );
  return { sections, hadNullSectionId };
}

// ------------------------------------------------------------------
// Blocks
// ------------------------------------------------------------------

function page(inner: string, opts: { fullBleed?: boolean; cls?: string } = {}) {
  return `<section class="page ${opts.cls ?? ''}">${
    opts.fullBleed ? '' : '<div class="geo-bg"></div>'
  }${inner}${
    opts.fullBleed
      ? ''
      : '<div class="foot"><span>ABAK Engineering Consultancy</span><span class="foot-ref"></span></div>'
  }</section>`;
}

function pageHeader(company: DocCompany | null, right: string) {
  const logo = company?.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="logo" onerror="this.style.display='none'"/>`
    : `<div class="logo-text">${esc(company?.legalName ?? 'ABAK')}</div>`;
  return `<div class="hdr"><div class="logo">${logo}</div><div class="hdr-right">${right}</div></div>`;
}

function coverBlock(quote: LoadedQuote, company: DocCompany | null): string {
  const clientName =
    quote.client?.companyName ?? quote.client?.contactName ?? '';
  const date = quote.sentAt ?? quote.createdAt;
  return page(
    `<div class="cover-shapes"></div>
     <div class="cover-content">
       <div class="cover-logo">${
         company?.logoUrl
           ? `<img src="${esc(company.logoUrl)}" onerror="this.style.display='none'"/>`
           : `<div class="logo-text big">${esc(company?.legalName ?? 'ABAK')}</div>`
       }</div>
       <div class="cover-title">${esc(quote.title)}</div>
       <div class="cover-sub">عرض سعر خدمات استشارية هندسية</div>
       <div class="cover-attn">إلى</div>
       <div class="cover-attn-sub">${esc(clientName)}</div>
       <div class="cover-ref">رقم العرض: <strong dir="ltr">${esc(quote.quoteNumber)}</strong>
         &nbsp;|&nbsp; التاريخ: ${esc(new Date(date).toLocaleDateString('en-GB'))}</div>
     </div>`,
    { fullBleed: true, cls: 'cover' },
  );
}

function aboutBlock(company: DocCompany | null): string {
  if (!company) return '';
  const about = company.aboutTextAr ?? company.aboutText ?? '';
  const services = Array.isArray(company.services)
    ? (company.services as unknown[]).map(nameOf).filter(Boolean)
    : [];
  const accred = Array.isArray(company.accreditations)
    ? (company.accreditations as unknown[]).map(nameOf).filter(Boolean)
    : [];
  return page(
    `${pageHeader(company, '<div class="hdr-title">من نحن</div>')}
     <div class="body">
       <div class="section-title">من نحن</div>
       <div class="about-text"><p>${esc(about)}</p></div>
       ${
         services.length
           ? `<div class="section-title">خدماتنا</div>
              <ul class="services">${services
                .map((s) => `<li>${esc(s)}</li>`)
                .join('')}</ul>`
           : ''
       }
       ${
         accred.length
           ? `<div class="accreditation"><h4>اعتمادات وتسجيلات</h4><p>${accred
               .map((a) => esc(a))
               .join(' • ')}</p></div>`
           : ''
       }
       <div class="contact-bar">
         ${company.website ? `<span>${esc(company.website)}</span>` : ''}
         ${company.email ? `<span>${esc(company.email)}</span>` : ''}
         ${(company.address ?? company.addressAr) ? `<span>${esc(company.addressAr ?? company.address ?? '')}</span>` : ''}
       </div>
     </div>`,
  );
}

function scopePricingBlocks(
  quote: LoadedQuote,
  company: DocCompany | null,
  sections: RenderSection[],
): string {
  // Per-department scope + pricing pages (line subtotal ONLY — no VAT).
  const sectionPages = sections
    .map((s) => {
      // RVd-12 (per-visit): label the qty/unit-price columns by pricing model so
      // the client can see qty=10 means 10 VISITS on a PER_VISIT (Supervision)
      // section, not 10 generic units.
      const perVisit = s.pricingModel === 'PER_VISIT';
      const qtyLabel = perVisit ? 'عدد الزيارات' : 'الكمية';
      const unitPriceLabel = perVisit ? 'سعر الزيارة' : 'سعر الوحدة';
      // RVd-7 (per-line reconciliation): round each cell to 2dp and push the
      // sub-cent residual onto the LAST line, so the printed الإجمالي cells sum
      // EXACTLY to the printed إجمالي القسم below them.
      const printedSubtotals = allocateResidual(
        s.items.map((it) => it.subtotal),
        round2(s.lineSubtotal),
      );
      const rows = s.items
        .map(
          (it, i) => `<tr>
            <td>${esc(it.description)}</td>
            <td class="n">${num(it.quantity)}</td>
            <td class="c">${esc(it.unit ?? '—')}</td>
            <td class="n">${money(it.unitPrice)}</td>
            <td class="n">${money(printedSubtotals[i])}</td>
          </tr>`,
        )
        .join('');
      return page(
        `${pageHeader(company, `<div class="quote-ref-box" dir="ltr">${esc(quote.quoteNumber)}</div>`)}
         <div class="body">
           <div class="section-title">${esc(s.deptName)}${
             s.isLead ? ' <span class="lead-badge">القسم الرئيسي</span>' : ''
           }${perVisit ? ' <span class="lead-badge">حسب الزيارة</span>' : ''}</div>
           ${s.scopeText ? `<div class="scope-text">${esc(s.scopeText)}</div>` : ''}
           <table class="quote-table">
             <thead><tr>
               <th>نطاق العمل</th><th class="n">${qtyLabel}</th><th class="c">الوحدة</th>
               <th class="n">${unitPriceLabel}</th><th class="n">الإجمالي</th>
             </tr></thead>
             <tbody>${rows || '<tr><td colspan="5" class="c">—</td></tr>'}</tbody>
           </table>
           <div class="dept-subtotal">
             <span>إجمالي القسم (قبل الضريبة)</span>
             <span class="n">${money(round2(s.lineSubtotal))}</span>
           </div>
         </div>`,
      );
    })
    .join('');

  // Combined totals band — ONCE (blocker #2). subtotal − discount + VAT = total.
  const inWords = amountInWords(quote.totalAmount, { locale: 'ar' });
  // RVd-1 renderer safety-net: never silently print a document whose own band
  // does not reconcile. If subtotal − discount + VAT ≠ total (the stale-totals
  // bug surfaces here), stamp a loud DRAFT banner so a divergent quote can never
  // be mistaken for a clean, signable offer.
  const reconciles =
    Math.abs(
      quote.subtotal -
        quote.discountAmount +
        quote.taxAmount -
        quote.totalAmount,
    ) <= 0.01;
  const inconsistentBanner = reconciles
    ? ''
    : `<div class="totals-warning">مسودة — الإجماليات غير متطابقة (DRAFT — totals inconsistent)</div>`;
  // RVd-4/RVd-6 (summary reconciliation): round each dept subtotal to 2dp and
  // push the sub-cent residual onto the LAST department row, so the summary-table
  // column the client adds up sums EXACTLY to the المجموع الفرعي printed beneath
  // it (never 0.01 off on a signed offer).
  const summarySubtotals = allocateResidual(
    sections.map((s) => s.lineSubtotal),
    quote.subtotal,
  );
  const totalsPage = page(
    `${pageHeader(company, `<div class="quote-ref-box" dir="ltr">${esc(quote.quoteNumber)}</div>`)}
     <div class="body">
       ${inconsistentBanner}
       <div class="section-title">الإجمالي</div>
       <table class="quote-table summary">
         <thead><tr><th>القسم</th><th class="n">الإجمالي (قبل الضريبة)</th></tr></thead>
         <tbody>${sections
           .map(
             (s, i) =>
               `<tr><td>${esc(s.deptName)}</td><td class="n">${money(summarySubtotals[i])}</td></tr>`,
           )
           .join('')}</tbody>
       </table>
       <div class="totals">
         <div class="row"><span>المجموع الفرعي</span><span class="n">${money(quote.subtotal)}</span></div>
         ${
           quote.discountAmount > 0
             ? `<div class="row"><span>الخصم</span><span class="n">- ${money(quote.discountAmount)}</span></div>`
             : ''
         }
         <div class="row"><span>ضريبة القيمة المضافة (${num(quote.taxRate)}%)</span><span class="n">${money(quote.taxAmount)}</span></div>
         <div class="row grand"><span>الإجمالي شامل الضريبة</span><span class="n">${money(quote.totalAmount)}</span></div>
       </div>
       <div class="words"><strong>فقط:</strong> ${esc(inWords)}</div>
     </div>`,
  );

  return sectionPages + totalsPage;
}

function paymentBlock(quote: LoadedQuote, company: DocCompany | null): string {
  if (quote.paymentMilestones.length === 0) return '';
  // RVd-3/RVd-8 (milestone reconciliation): render the STORED, server
  // penny-reconciled PaymentMilestone.amount (the service allocates the residual
  // to the last milestone on write) instead of re-deriving (pct/100)*total per
  // row — which independently rounds each row and lands the column 0.01 off the
  // grand total (e.g. 33.33/33.33/33.34 of 31050). As a safety net for any
  // legacy row whose stored amount predates the write-time reconciliation, the
  // renderer re-allocates the residual onto the last row so the printed المبلغ
  // column sums EXACTLY to the printed grand total.
  const printedAmounts = allocateResidual(
    quote.paymentMilestones.map(
      (m) =>
        (m as { amount?: number }).amount ??
        (m.percentage / 100) * quote.totalAmount,
    ),
    quote.totalAmount,
  );
  const rows = quote.paymentMilestones
    .map(
      (m, i) => `<tr>
        <td class="c">${num(i + 1)}</td>
        <td>${esc(m.description)}</td>
        <td class="n">${num(m.percentage)}%</td>
        <td class="n">${money(printedAmounts[i])}</td>
      </tr>`,
    )
    .join('');
  return page(
    `${pageHeader(company, '<div class="hdr-title">نظام الدفع</div>')}
     <div class="body">
       <div class="section-title">جدول الدفعات</div>
       <table class="quote-table">
         <thead><tr><th class="c">#</th><th>الدفعة</th><th class="n">النسبة</th><th class="n">المبلغ</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>`,
  );
}

function methodologyBlock(
  quote: LoadedQuote,
  company: DocCompany | null,
  sections: RenderSection[],
): string {
  const groups = sections
    .map((s) => {
      const cards = s.items
        .map((it) => it.methodologyCard)
        .filter((c): c is NonNullable<typeof c> => !!c);
      if (!cards.length) return '';
      return `<div class="section-title">${esc(s.deptName)}</div>
        ${cards
          .map(
            (card) => `<div class="method-card">
              <div class="method-desc">${esc(card.description)}</div>
              ${
                Array.isArray(card.steps)
                  ? `<ol class="method-steps">${(card.steps as unknown[])
                      .map((st) => `<li>${esc(String(st))}</li>`)
                      .join('')}</ol>`
                  : ''
              }
              ${card.deliverable ? `<div class="method-deliverable">✓ ${esc(card.deliverable)}</div>` : ''}
            </div>`,
          )
          .join('')}`;
    })
    .filter(Boolean)
    .join('');
  if (!groups) return '';
  return page(
    `${pageHeader(company, '<div class="hdr-title">منهجية التنفيذ</div>')}
     <div class="body"><div class="section-title">منهجية تنفيذ المشروع</div>${groups}</div>`,
  );
}

function timelineBlock(
  quote: LoadedQuote,
  company: DocCompany | null,
  sections: RenderSection[],
): string {
  const rows = sections
    .flatMap((s) =>
      s.items
        .filter((it) => it.ganttBlock)
        .map((it) => {
          const g = it.ganttBlock!;
          return `<tr>
            <td>${esc(it.description)}</td>
            <td class="c">${esc(s.deptName)}</td>
            <td class="n" dir="ltr">${num(g.startDay)}</td>
            <td class="n" dir="ltr">${num(g.durationDays)} يوم</td>
          </tr>`;
        }),
    )
    .join('');
  if (!rows) return '';
  return page(
    `${pageHeader(company, '<div class="hdr-title">الجدول الزمني</div>')}
     <div class="body">
       <div class="section-title">الجدول الزمني للتنفيذ</div>
       <table class="quote-table">
         <thead><tr><th>البند</th><th class="c">القسم</th><th class="n">يبدأ (يوم)</th><th class="n">المدة</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>`,
  );
}

function requirementsBlock(
  quote: LoadedQuote,
  company: DocCompany | null,
): string {
  // §14 deduped requirements/notes. DOC-7: client boilerplate-with-overrides —
  // NEVER the internal RfqDocRequest asks.
  if (quote.requirements.length === 0) return '';
  const docs = quote.requirements.filter((r) => r.type === 'DOCUMENT');
  const notes = quote.requirements.filter((r) => r.type !== 'DOCUMENT');
  return page(
    `${pageHeader(company, '<div class="hdr-title">المتطلبات والملاحظات</div>')}
     <div class="body">
       ${
         docs.length
           ? `<div class="section-title">المستندات المطلوبة من العميل</div>
              <ul class="req-list">${docs.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul>`
           : ''
       }
       ${
         notes.length
           ? `<div class="section-title">ملاحظات</div>
              <ul class="req-list">${notes.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul>`
           : ''
       }
     </div>`,
  );
}

function thankyouBlock(company: DocCompany | null): string {
  const bank = company?.bank;
  return page(
    `<div class="thanks-shapes"></div>
     <div class="thanks-content">
       <div class="thank-you-big">شكراً لكم</div>
       <div class="thanks-message">نتطلع إلى شراكة ناجحة معكم.</div>
       ${
         bank?.iban
           ? `<div class="bank-box">
                <div class="bank-title">التحويل البنكي</div>
                ${bank.bankName ? `<div>${esc(bank.bankName)}</div>` : ''}
                ${bank.bankAccountName ? `<div>${esc(bank.bankAccountName)}</div>` : ''}
                <div dir="ltr">IBAN: ${esc(bank.iban)}</div>
                ${bank.swift ? `<div dir="ltr">SWIFT: ${esc(bank.swift)}</div>` : ''}
              </div>`
           : ''
       }
       <div class="thanks-contact">
         ${company?.phone ? `<span dir="ltr">${esc(company.phone)}</span>` : ''}
         ${company?.email ? `<span>${esc(company.email)}</span>` : ''}
         ${company?.website ? `<span>${esc(company.website)}</span>` : ''}
       </div>
     </div>`,
    { fullBleed: true, cls: 'thanks' },
  );
}

// ------------------------------------------------------------------
// Document
// ------------------------------------------------------------------

export function renderQuoteDocument(
  quote: LoadedQuote,
  ctx: DocContext,
): string {
  const { sections } = resolveSections(quote);
  const company = ctx.company;

  const enabled = ctx.blocks
    .filter((b) => b.enabled)
    .sort((a, b) => a.position - b.position);

  const renderBlock = (type: string): string => {
    switch (type) {
      case 'COVER':
        return coverBlock(quote, company);
      case 'ABOUT':
        return aboutBlock(company);
      case 'SCOPE_PRICING':
        return scopePricingBlocks(quote, company, sections);
      case 'PAYMENT':
        return paymentBlock(quote, company);
      case 'METHODOLOGY':
        return methodologyBlock(quote, company, sections);
      case 'TIMELINE':
        return timelineBlock(quote, company, sections);
      case 'REQUIREMENTS_NOTES':
        return requirementsBlock(quote, company);
      case 'THANKYOU':
        return thankyouBlock(company);
      default:
        return '';
    }
  };

  const body = enabled.map((b) => renderBlock(b.sectionType)).join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/>
<style>${STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: A4; margin: 0; }
body { font-family: -apple-system, "Segoe UI", "Tahoma", "Calibri", sans-serif; color: #1a2a44; background: #fff; font-size: 12px; }
/* RVd-8 (pagination): a growable block (a long scope/pricing table or a long
   requirements list) makes a single logical .page exceed 297mm; Chromium then
   splits it across physical sheets. The OLD layout pinned the running footer
   with position:absolute (bottom:8mm) and clipped with overflow:hidden, so on a
   split page the footer printed mid-sheet and overlapped content. FIX: lay the
   page out as a flex column with the footer flowing at the end (margin-top:auto
   keeps it at the bottom on a non-overflowing page, and it flows after the
   content — never overlapping — when the page splits). overflow:visible so a
   split table is not clipped. Table headers repeat across sheets and rows are
   never cut mid-row (see .quote-table thead / tr rules below). */
.page { width: 210mm; min-height: 297mm; position: relative; overflow: visible; background: #fff; page-break-after: always; padding: 16mm 16mm 22mm; display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; }
.geo-bg { position: absolute; inset: 0; background:
  linear-gradient(135deg, rgba(26,42,68,0.03) 25%, transparent 25%) -10px 0,
  linear-gradient(45deg, rgba(184,146,75,0.03) 25%, transparent 25%);
  background-size: 30px 30px; z-index: 0; }
.hdr { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8mm; border-bottom: 2px solid #1a3a5c; position: relative; z-index: 2; }
.logo img { height: 50px; width: auto; object-fit: contain; }
.logo-text { font-size: 18px; font-weight: 800; color: #1a3a5c; letter-spacing: 1px; }
.logo-text.big { font-size: 34px; }
.hdr-right, .hdr-title { font-size: 13px; color: #1a3a5c; font-weight: 700; }
.quote-ref-box { background: #1a3a5c; color: #fff; padding: 6px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; }
.body { position: relative; z-index: 2; padding-top: 8mm; }
.section-title { font-size: 15px; color: #1a3a5c; font-weight: 800; border-inline-start: 4px solid #b8924b; padding-inline-start: 8px; margin: 14px 0 8px; }
.lead-badge { font-size: 10px; background: #fdf3e0; color: #8a5a12; padding: 2px 6px; border-radius: 8px; font-weight: 700; }
.about-text p { line-height: 1.9; margin-bottom: 8px; }
.services { columns: 2; margin: 6px 18px; line-height: 1.9; }
.accreditation { background: #f4f7fb; border-radius: 6px; padding: 10px; margin-top: 10px; }
.accreditation h4 { color: #1a3a5c; font-size: 12px; margin-bottom: 4px; }
.accreditation p { line-height: 1.8; color: #44546a; }
.contact-bar { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #44546a; }
.scope-text { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; line-height: 1.8; margin-bottom: 8px; }
.quote-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
/* RVd-8: when a long table splits across sheets, repeat the header row on each
   sheet and never cut a row mid-height. */
.quote-table thead { display: table-header-group; }
.quote-table tr { break-inside: avoid; page-break-inside: avoid; }
.quote-table th { background: #1a3a5c; color: #fff; text-align: start; padding: 8px; font-size: 11px; }
.quote-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
.quote-table tr:nth-child(even) td { background: #f8fafc; }
.quote-table.summary th { background: #44546a; }
td.n, th.n { text-align: end; font-variant-numeric: tabular-nums; }
td.c, th.c { text-align: center; }
.dept-subtotal { display: flex; justify-content: space-between; margin-top: 8px; padding: 8px 10px; background: #f4f7fb; border-radius: 6px; font-weight: 700; color: #1a3a5c; }
.totals-warning { background: #b91c1c; color: #fff; font-weight: 800; text-align: center; padding: 10px; border-radius: 6px; margin-bottom: 10px; letter-spacing: 0.5px; }
.totals { width: 320px; margin-inline-start: auto; margin-top: 14px; }
.totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
.totals .grand { border-top: 2px solid #1a3a5c; margin-top: 6px; padding-top: 8px; font-weight: 800; color: #1a3a5c; font-size: 14px; }
.words { margin-top: 12px; background: #f0f7f1; border: 1px solid #cce8d0; border-radius: 6px; padding: 10px; line-height: 1.8; }
.method-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
.method-desc { font-weight: 700; margin-bottom: 4px; }
.method-steps { margin: 4px 18px; line-height: 1.8; }
.method-deliverable { color: #1a7a3a; margin-top: 4px; font-size: 11px; }
.req-list { margin: 6px 18px; line-height: 2; }
/* RVd-8: a FLOW footer (margin-top:auto pins it to the bottom of a
   non-overflowing page; on a split/overflowing page it flows after the content
   instead of overlapping it as the old position:absolute footer did). */
.foot { margin-top: auto; padding-top: 4px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; z-index: 2; }
.req-list li { break-inside: avoid; page-break-inside: avoid; }
/* Cover */
.cover { background: linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%); padding: 0; }
.cover-shapes::before, .cover-shapes::after { content: ''; position: absolute; transform: rotate(45deg); }
.cover-shapes::before { width: 250mm; height: 250mm; top: -120mm; right: -100mm; background: linear-gradient(135deg, #1a3a5c, #2d5a8a); opacity: 0.08; }
.cover-shapes::after { width: 200mm; height: 200mm; bottom: -80mm; left: -80mm; background: linear-gradient(135deg, #b8924b, #d4af6f); opacity: 0.08; }
.cover-content { position: relative; z-index: 2; height: 297mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30mm 25mm; text-align: center; }
.cover-title { margin-top: 40mm; font-size: 24px; color: #1a3a5c; font-weight: 800; }
.cover-sub { font-size: 15px; color: #5a6a7c; margin-top: 6px; }
.cover-attn { margin-top: 25mm; font-size: 12px; color: #8a98a8; letter-spacing: 2px; }
.cover-attn-sub { font-size: 18px; color: #1a3a5c; font-weight: 700; margin-top: 4px; }
.cover-ref { margin-top: 30mm; font-size: 12px; color: #44546a; }
/* Thanks */
.thanks { background: linear-gradient(135deg, #1a3a5c 0%, #2d5a8a 100%); color: #fff; padding: 0; }
.thanks-content { position: relative; z-index: 2; height: 297mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30mm; text-align: center; }
.thank-you-big { font-size: 44px; font-weight: 800; }
.thanks-message { margin-top: 10px; font-size: 16px; opacity: .9; }
.bank-box { margin-top: 30mm; background: rgba(255,255,255,0.12); border-radius: 8px; padding: 16px 24px; line-height: 1.9; }
.bank-title { font-weight: 700; margin-bottom: 6px; color: #d4af6f; }
.thanks-contact { margin-top: 18mm; display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; font-size: 12px; opacity: .9; }
`;
