import { QuoteStatus, RfqStatus } from '@prisma/client';

/**
 * DM-2: the sales-facing display status. The thin RFQ only stores intake states
 * (SUBMITTED/ASSIGNED/PRICING/CANCELLED/DECLINED); everything past the seam is
 * derived from the linked Quote's status — there is no second write.
 */
export type RfqDisplayStatus =
  | 'SUBMITTED'
  | 'DECLINED_WRONG_DEPT'
  | 'DECLINED_NO_BID'
  | 'CANCELLED'
  | 'PRICING'
  | 'IN_APPROVAL'
  | 'QUOTE_READY'
  | 'SENT'
  | 'WON'
  | 'LOST'
  | 'POSTPONED';

/**
 * Compute the sales-facing status from the thin RFQ + its (optional) Quote.
 * rfq.quote is the source of truth once it exists; RfqStatus only governs the
 * pre-quote intake states.
 */
export function deriveRfqDisplayStatus(rfq: {
  status: RfqStatus;
  declineType?: 'WRONG_DEPT' | 'NO_BID' | null;
  quote?: { status: QuoteStatus } | null;
}): RfqDisplayStatus {
  if (rfq.status === RfqStatus.CANCELLED) return 'CANCELLED';
  if (rfq.status === RfqStatus.DECLINED)
    return rfq.declineType === 'NO_BID'
      ? 'DECLINED_NO_BID'
      : 'DECLINED_WRONG_DEPT';
  if (!rfq.quote)
    return rfq.status === RfqStatus.PRICING ? 'PRICING' : 'SUBMITTED';

  switch (rfq.quote.status) {
    case QuoteStatus.DRAFT:
    case QuoteStatus.IN_REVISION:
    case QuoteStatus.REVISED:
      return 'PRICING';
    case QuoteStatus.PENDING_REVIEW:
    case QuoteStatus.PENDING_APPROVAL:
      return 'IN_APPROVAL';
    case QuoteStatus.APPROVED:
      return 'QUOTE_READY';
    case QuoteStatus.SENT:
    case QuoteStatus.IN_DISCUSSION:
    case QuoteStatus.IN_NEGOTIATION:
      return 'SENT';
    case QuoteStatus.WON:
      return 'WON';
    case QuoteStatus.LOST:
      return 'LOST';
    case QuoteStatus.POSTPONED:
      return 'POSTPONED';
    case QuoteStatus.EXPIRED:
      return 'SENT';
    case QuoteStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'PRICING';
  }
}
