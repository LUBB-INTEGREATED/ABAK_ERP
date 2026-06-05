import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ScopeContext } from '../auth/scope.util';
import { QuotesService } from '../quotes/quotes.service';
import { PdfRenderService } from './pdf-render.service';
import {
  type DocBlock,
  type DocCompany,
  type DocContext,
  type LoadedQuote,
  renderQuoteDocument,
} from './quote-document.renderer';

// RV-4: the escape helper now lives in the renderer; re-exported so the existing
// escape spec (and any caller) keeps importing it from here.
export { esc } from './quote-document.renderer';

// The canonical 8 blocks — fallback when neither a manifest nor a seeded default
// template is available (so a legacy quote still renders the full document).
const FALLBACK_BLOCKS: DocBlock[] = [
  'COVER',
  'ABOUT',
  'SCOPE_PRICING',
  'PAYMENT',
  'METHODOLOGY',
  'TIMELINE',
  'REQUIREMENTS_NOTES',
  'THANKYOU',
].map((sectionType, position) => ({ sectionType, enabled: true, position }));

interface ManifestShape {
  schema?: number;
  sections?: { sectionType: string; enabled: boolean; position: number }[];
  company?: DocCompany | null;
}

/**
 * DOC-3: turns a quote into the real 8-block A4 price-offer PDF via
 * {@link PdfRenderService}. The document composition is resolved from the
 * quote's renderManifest (as-issued, snapshot on send) when present, else live
 * from the default template + active CompanyProfile.
 */
@Injectable()
export class QuotePdfService {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: PdfRenderService,
    private readonly prisma: PrismaService,
  ) {}

  async renderQuotePdf(id: string, scope?: ScopeContext): Promise<Buffer> {
    const html = await this.renderQuoteHtml(id, scope);
    // Full-bleed: margins 0 (cover/thanks bleed to the edge; content pages pad
    // internally + carry their own running footer).
    return this.pdf.htmlToPdf(html, {
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  }

  /** The document HTML — the single renderer shared by the PDF + the preview. */
  async renderQuoteHtml(id: string, scope?: ScopeContext): Promise<string> {
    const quote = await this.quotes.findOne(id, scope);
    const ctx = await this.resolveDocContext(quote);
    return renderQuoteDocument(quote, ctx);
  }

  private async resolveDocContext(quote: LoadedQuote): Promise<DocContext> {
    // RVd-13 — SCOPE OF THE "AS-ISSUED" FREEZE (documented, by design):
    // The renderManifest snapshots ONLY the document COMPOSITION that lives
    // outside the quote row — the template block layout (which blocks, order,
    // enabled) and the CompanyProfile content (legal name, about, services,
    // accreditations, contact, bank, logo). It deliberately does NOT snapshot the
    // priced data — quote.subtotal / discountAmount / taxRate / taxAmount /
    // totalAmount, items, department scope text, payment milestones, requirements
    // and amount-in-words are all read LIVE from the quote at render time.
    //
    // That is SAFE because those priced fields are immutable post-SEND: update()
    // hard-gates on `status === DRAFT` (quotes.service.ts), and approve/send do
    // not mutate them. So once a quote is SENT the live read and the value
    // at-issue are guaranteed identical — re-snapshotting them would be redundant.
    // The ONE thing the manifest freezes that genuinely CAN change later is the
    // template + company composition, which is exactly what it stores. (If a
    // future requirement allows post-send re-pricing, extend buildRenderManifest
    // to also snapshot totals/items/scope/milestones.)
    //
    // As-issued: render from the snapshot taken on send.
    const manifest = quote.renderManifest as ManifestShape | null;
    if (manifest && Array.isArray(manifest.sections)) {
      return {
        asIssued: true,
        blocks: manifest.sections.map((s) => ({
          sectionType: s.sectionType,
          enabled: s.enabled,
          position: s.position,
        })),
        company: manifest.company ?? (await this.liveCompany()),
      };
    }

    // Live: the default template + active company profile.
    const template = await this.prisma.quoteTemplate.findFirst({
      where: { isDefault: true, isActive: true },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
    const blocks: DocBlock[] = template
      ? template.sections.map((s) => ({
          sectionType: s.sectionType,
          enabled: s.enabled,
          position: s.position,
        }))
      : FALLBACK_BLOCKS;
    return {
      asIssued: false,
      blocks: blocks.length ? blocks : FALLBACK_BLOCKS,
      company: await this.liveCompany(),
    };
  }

  private async liveCompany(): Promise<DocCompany | null> {
    const p = await this.prisma.companyProfile.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!p) return null;
    return {
      legalName: p.legalName,
      legalNameAr: p.legalNameAr,
      aboutText: p.aboutText,
      aboutTextAr: p.aboutTextAr,
      services: p.services,
      accreditations: p.accreditations,
      phone: p.phone,
      email: p.email,
      website: p.website,
      address: p.address,
      addressAr: p.addressAr,
      logoUrl: p.logoUrl,
      bank: {
        bankName: p.bankName,
        bankAccountName: p.bankAccountName,
        iban: p.iban,
        swift: p.swift,
      },
    };
  }
}
