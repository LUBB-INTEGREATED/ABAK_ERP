import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';

export interface PdfRenderOptions {
  /** Header template HTML (Playwright tokens like <span class="pageNumber">). */
  headerHtml?: string;
  /** Footer template HTML (page counters etc.). */
  footerHtml?: string;
  /** Page margins. DOC-3 passes 0 for the full-bleed 8-block document (the
   *  cover/thanks pages bleed to the edge; content pages pad internally). */
  margin?: { top: string; bottom: string; left: string; right: string };
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

  protected async browser(): Promise<Browser> {
    // A-5: never leave a rejected or crashed browser cached. Before reusing a
    // cached launch, await it and verify the browser is still connected; if the
    // launch failed or the browser died, drop the cache and relaunch. Without
    // this, a single launch failure cached a rejected promise forever and broke
    // ALL PDF rendering until a process restart.
    if (this.browserPromise) {
      try {
        const existing = await this.browserPromise;
        if (existing.isConnected()) return existing;
      } catch {
        // fall through to relaunch
      }
      this.browserPromise = undefined;
    }

    const launch = this.launchBrowser().catch((err) => {
      // Clear the cache so the NEXT request retries instead of re-awaiting a
      // permanently-rejected promise.
      if (this.browserPromise === launch) this.browserPromise = undefined;
      this.logger.error(`Chromium launch failed: ${String(err)}`);
      throw err;
    });
    this.browserPromise = launch;
    return launch;
  }

  /** Seam for tests; production launches a sandboxed headless Chromium. */
  protected launchBrowser(): Promise<Browser> {
    return chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
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
        margin: opts.margin ?? {
          top: '18mm',
          bottom: '18mm',
          left: '14mm',
          right: '14mm',
        },
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
