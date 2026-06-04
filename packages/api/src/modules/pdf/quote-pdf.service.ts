import { Injectable } from '@nestjs/common';
import { amountInWords, formatCurrency, formatNumber } from 'shared-utils';
import type { ScopeContext } from '../auth/scope.util';
import { QuotesService } from '../quotes/quotes.service';
import { PdfRenderService } from './pdf-render.service';

type LoadedQuote = Awaited<ReturnType<QuotesService['findOne']>>;

const money = (n: number) =>
  formatCurrency(n, { locale: 'ar', numerals: 'latin' });
const num = (n: number) =>
  formatNumber(n, { numerals: 'latin', grouping: false });
export const esc = (s: string) =>
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

/**
 * PDF-1 spike renderer: turns a real quote into an A4 PDF via {@link
 * PdfRenderService}. This is a deliberately representative document (cover band,
 * scope table, totals + amount-in-words, payment schedule on its own page) that
 * proves the pipeline end-to-end. The full 8-block, manifest-driven document is
 * DOC-3 in the roadmap — this service is the seam it will grow into.
 */
@Injectable()
export class QuotePdfService {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: PdfRenderService,
  ) {}

  async renderQuotePdf(id: string, scope?: ScopeContext): Promise<Buffer> {
    const quote = await this.quotes.findOne(id, scope);
    const html = this.buildHtml(quote);
    return this.pdf.htmlToPdf(html, {
      footerHtml:
        '<div style="width:100%;font-size:8px;color:#94a3b8;text-align:center;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  }

  private buildHtml(quote: LoadedQuote): string {
    const clientName =
      quote.client?.companyName ?? quote.client?.contactName ?? 'العميل';
    const rows = quote.items
      .map((it) => {
        const dept = it.department?.nameAr ?? it.department?.name ?? '—';
        return `<tr>
          <td>${esc(it.description)}</td>
          <td class="c">${esc(dept)}</td>
          <td class="n">${num(it.quantity)}</td>
          <td class="c">${esc(it.unit ?? '—')}</td>
          <td class="n">${money(it.unitPrice)}</td>
          <td class="n">${money(it.subtotal)}</td>
        </tr>`;
      })
      .join('');

    const milestones = quote.paymentMilestones
      .map(
        (m, i) => `<tr>
          <td class="c">${num(i + 1)}</td>
          <td>${esc(m.description)}</td>
          <td class="n">${num(m.percentage)}%</td>
          <td class="n">${money((m.percentage / 100) * quote.totalAmount)}</td>
        </tr>`,
      )
      .join('');

    const inWords = amountInWords(quote.totalAmount, { locale: 'ar' });

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; }
  body { font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
  .band { background: #0b3d91; color: #fff; padding: 24px 20px; border-radius: 8px; }
  .band h1 { margin: 0 0 4px; font-size: 20px; }
  .band p { margin: 0; opacity: .9; font-size: 12px; }
  .meta { display: flex; justify-content: space-between; margin: 16px 0; gap: 12px; }
  .meta div { background: #f1f5f9; padding: 10px 12px; border-radius: 6px; flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #e2e8f0; text-align: start; padding: 8px; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
  td.n, th.n { text-align: end; font-variant-numeric: tabular-nums; }
  td.c, th.c { text-align: center; }
  .totals { width: 280px; margin-inline-start: auto; margin-top: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #0b3d91; margin-top: 6px; padding-top: 8px; font-weight: 700; color: #0b3d91; }
  .words { margin-top: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px; }
  .page2 { break-before: page; padding-top: 8px; }
  h2 { font-size: 15px; color: #0b3d91; margin: 0 0 6px; }
</style>
</head>
<body>
  <div class="band">
    <h1>عرض سعر — ${esc(quote.quoteNumber)}</h1>
    <p>${esc(quote.title)}</p>
  </div>

  <div class="meta">
    <div><strong>العميل:</strong><br/>${esc(clientName)}</div>
    <div><strong>صالح حتى:</strong><br/>${
      quote.validUntil
        ? esc(new Date(quote.validUntil).toLocaleDateString('en-GB'))
        : '—'
    }</div>
  </div>

  <h2>بنود العرض</h2>
  <table>
    <thead>
      <tr>
        <th>الوصف</th><th class="c">القسم</th><th class="n">الكمية</th>
        <th class="c">الوحدة</th><th class="n">سعر الوحدة</th><th class="n">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>المجموع الفرعي</span><span>${money(quote.subtotal)}</span></div>
    ${
      quote.discountAmount > 0
        ? `<div class="row"><span>الخصم</span><span>-${money(quote.discountAmount)}</span></div>`
        : ''
    }
    <div class="row"><span>ضريبة القيمة المضافة (${num(quote.taxRate)}%)</span><span>${money(quote.taxAmount)}</span></div>
    <div class="row grand"><span>الإجمالي</span><span>${money(quote.totalAmount)}</span></div>
  </div>
  <div class="words"><strong>فقط:</strong> ${esc(inWords)}</div>

  <div class="page2">
    <h2>جدول الدفعات</h2>
    <table>
      <thead>
        <tr><th class="c">#</th><th>الدفعة</th><th class="n">النسبة</th><th class="n">المبلغ</th></tr>
      </thead>
      <tbody>${milestones || '<tr><td colspan="4" class="c">—</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;
  }
}
