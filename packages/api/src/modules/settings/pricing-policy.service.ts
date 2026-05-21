import { Injectable } from '@nestjs/common';
import { Prisma, PricingPolicyMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PricingPolicy is a singleton — one row in the DB. The seed migration
 * creates a row with id `default-policy`; we look that up here. If it's
 * been deleted (shouldn't happen in normal use), we re-create it with
 * sensible defaults.
 *
 * Added 2026-05-21 as part of the process correction. The policy drives
 * both quote approval routing AND discount approval routing — sales
 * person grants up to `salesCeilingPct` without approval; anything above
 * flows through the configured tiered OR sequential chain.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §6 "Discount approval".
 */

const SINGLETON_ID = 'default-policy';

export interface PricingPolicyTier {
  /** Maximum discount % covered by this tier. */
  upToPct: number;
  /** Approver role required at this tier. */
  approver: 'SALES_MANAGER' | 'CEO' | 'TECHNICAL_MANAGER' | 'FINANCE_MANAGER';
}

export interface PricingPolicySequenceItem {
  approver: 'SALES_MANAGER' | 'CEO' | 'TECHNICAL_MANAGER' | 'FINANCE_MANAGER';
  order: number;
}

export interface UpdatePricingPolicyDto {
  salesCeilingPct?: number;
  mode?: PricingPolicyMode;
  tiers?: PricingPolicyTier[];
  sequence?: PricingPolicySequenceItem[];
  vatPct?: number;
  currency?: string;
}

@Injectable()
export class PricingPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate() {
    let row = await this.prisma.pricingPolicy.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!row) {
      row = await this.prisma.pricingPolicy.create({
        data: {
          id: SINGLETON_ID,
          salesCeilingPct: 5,
          mode: PricingPolicyMode.TIERED,
          tiers: [
            { upToPct: 10, approver: 'SALES_MANAGER' },
            { upToPct: 100, approver: 'CEO' },
          ] as unknown as Prisma.InputJsonValue,
          sequence: [] as unknown as Prisma.InputJsonValue,
          vatPct: 15,
          currency: 'SAR',
        },
      });
    }
    return row;
  }

  async update(dto: UpdatePricingPolicyDto, actorId: string) {
    const existing = await this.getOrCreate();
    return this.prisma.pricingPolicy.update({
      where: { id: existing.id },
      data: {
        ...(dto.salesCeilingPct !== undefined && {
          salesCeilingPct: dto.salesCeilingPct,
        }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.tiers !== undefined && {
          tiers: dto.tiers as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.sequence !== undefined && {
          sequence: dto.sequence as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.vatPct !== undefined && { vatPct: dto.vatPct }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        updatedById: actorId,
      },
    });
  }

  /**
   * Helper used by the quote module: given a requested discount %, returns
   * the ordered chain of approver roles that must approve. Empty array =
   * within sales ceiling, no approval needed.
   */
  async resolveApprovalChain(
    discountPct: number,
  ): Promise<PricingPolicyTier['approver'][]> {
    const policy = await this.getOrCreate();
    if (discountPct <= policy.salesCeilingPct) return [];

    if (policy.mode === PricingPolicyMode.TIERED) {
      const tiers = (policy.tiers as unknown as PricingPolicyTier[]) ?? [];
      // Find the tier that covers this discount %. Tiers are progressive:
      // {upTo: 10, approver: MANAGER}, {upTo: 100, approver: CEO}.
      // For discount of 12, both tiers apply (MANAGER + CEO) because we
      // must climb the ladder. Implementation: collect every tier where
      // upToPct < discount, plus the first tier that >= discount.
      const sorted = [...tiers].sort((a, b) => a.upToPct - b.upToPct);
      const chain: PricingPolicyTier['approver'][] = [];
      for (const tier of sorted) {
        chain.push(tier.approver);
        if (tier.upToPct >= discountPct) break;
      }
      return chain;
    }

    // Sequential mode: every approver in the configured order.
    const sequence =
      (policy.sequence as unknown as PricingPolicySequenceItem[]) ?? [];
    return [...sequence]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.approver);
  }
}
