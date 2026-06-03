import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';

export interface PdfRenderOptions {
  /** Header template HTML (Playwright tokens like <span class="pageNumber">). */
  headerHtml?: string;
  /** Footer template HTML (page counters etc.). */
  footerHtml?: string;
}

/**
 * PDF-1 infra spike: render a full HTML document to an A4 PDF via headless
 * Chromium, backgrounds intact. A single browser is launched lazily and reused
 * across requests; it is closed on shutdown.
 *
 * The API runs as a persistent Nest server, so we use the full `playwright`
 * package (bundled Chromium). For a serverless target swap in `playwright-core`
 * + `@sparticuz/chromium` behind this same service.
 */
@Injectable()
export class PdfRenderService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderService.name);
  private browserPromise?: Promise<Browser>;

  private browser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }

  async htmlToPdf(html: string, opts: PdfRenderOptions = {}): Promise<Buffer> {
    const browser = await this.browser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      const displayHeaderFooter = Boolean(opts.headerHtml || opts.footerHtml);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter,
        headerTemplate: opts.headerHtml ?? '<span></span>',
        footerTemplate: opts.footerHtml ?? '<span></span>',
        margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
      });
      this.logger.debug(`rendered ${pdf.byteLength}B A4 PDF`);
      return pdf;
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise.catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
