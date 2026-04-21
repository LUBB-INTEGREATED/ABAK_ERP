import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AssignmentStrategy = 'round_robin' | 'load_based' | 'off';

const ACTIVE_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.ASSIGNED,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
];

const REP_ROLES: UserRole[] = [
  UserRole.SALES_REPRESENTATIVE,
  UserRole.SALES_MANAGER,
];

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStrategy(): Promise<AssignmentStrategy> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'lead_auto_assign_strategy' },
    });
    const value = setting?.value ?? 'off';
    if (value === 'round_robin' || value === 'load_based' || value === 'off') {
      return value;
    }
    this.logger.warn(
      `Unknown lead_auto_assign_strategy "${value}", defaulting to off.`,
    );
    return 'off';
  }

  /**
   * Return the user id to assign the next lead to, or null when auto-assign is
   * disabled or no eligible rep exists. Writes no state — callers apply the
   * assignment inside their own transaction.
   */
  async pickAssignee(): Promise<string | null> {
    const strategy = await this.getStrategy();
    if (strategy === 'off') return null;

    const reps = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: REP_ROLES },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (reps.length === 0) return null;

    if (strategy === 'load_based') {
      return this.pickByLoad(reps.map((r) => r.id));
    }
    return this.pickByRoundRobin(reps.map((r) => r.id));
  }

  private async pickByLoad(candidateIds: string[]): Promise<string> {
    const loads = await this.prisma.lead.groupBy({
      by: ['assignedToId'],
      where: {
        deletedAt: null,
        assignedToId: { in: candidateIds },
        status: { in: ACTIVE_LEAD_STATUSES },
      },
      _count: { _all: true },
    });
    const loadById = new Map<string, number>();
    for (const row of loads) {
      if (row.assignedToId) loadById.set(row.assignedToId, row._count._all);
    }
    let best = candidateIds[0];
    let bestLoad = loadById.get(best) ?? 0;
    for (const id of candidateIds) {
      const load = loadById.get(id) ?? 0;
      if (load < bestLoad) {
        best = id;
        bestLoad = load;
      }
    }
    return best;
  }

  private async pickByRoundRobin(candidateIds: string[]): Promise<string> {
    // The most-recently assigned rep sits at the end of the queue; the next
    // lead goes to whoever is furthest from the last pick.
    const lastAssigned = await this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        assignedToId: { in: candidateIds },
      },
      orderBy: { assignedAt: 'desc' },
      select: { assignedToId: true },
    });

    if (!lastAssigned?.assignedToId) return candidateIds[0];

    const index = candidateIds.indexOf(lastAssigned.assignedToId);
    if (index === -1) return candidateIds[0];
    return candidateIds[(index + 1) % candidateIds.length];
  }
}
