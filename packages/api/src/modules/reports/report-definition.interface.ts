import type { UserRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type ReportCategory =
  | 'sales'
  | 'rfq'
  | 'project'
  | 'finance'
  | 'gov'
  | 'sla'
  | 'executive';

export interface ReportColumn {
  key: string;
  labelAr: string;
  labelEn: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'percent';
}

export interface FilterSpec {
  key: string;
  type: 'date' | 'dateRange' | 'string' | 'enum';
  required?: boolean;
  enumValues?: string[];
  labelAr: string;
  labelEn: string;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  userId?: string;
  clientId?: string;
  status?: string;
  channel?: string;
  region?: string;
  [key: string]: string | undefined;
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
  meta: {
    reportCode: string;
    generatedAt: string;
    filters: ReportFilters;
    totalRows: number;
    columns: ReportColumn[];
  };
}

export interface ReportDefinition {
  code: string;
  nameAr: string;
  nameEn: string;
  category: ReportCategory;
  minRoles: UserRole[];
  filters: FilterSpec[];
  columns: ReportColumn[];
  run(
    prisma: PrismaService,
    filters: ReportFilters,
  ): Promise<Omit<ReportResult, 'meta'>>;
}
