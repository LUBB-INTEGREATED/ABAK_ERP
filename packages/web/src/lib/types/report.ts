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

export interface ReportMeta {
  code: string;
  nameAr: string;
  nameEn: string;
  filters: FilterSpec[];
  columns: ReportColumn[];
}

export interface CatalogEntry {
  category: ReportCategory;
  reports: ReportMeta[];
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
  meta: {
    reportCode: string;
    generatedAt: string;
    filters: Record<string, string>;
    totalRows: number;
    columns: ReportColumn[];
  };
}

export interface SavedReport {
  id: string;
  reportCode: string;
  name: string;
  filters: Record<string, string>;
  scheduledCron?: string;
  recipients: string[];
  createdAt: string;
}

export interface ExecutiveKpis {
  monthlyRevenue: { actual: number; target: number };
  winRate: number;
  pipelineFunnel: { stage: string; count: number; value: number }[];
  collectionEfficiency: number;
  openInvoicesCount: number;
  openInvoicesValue: number;
  activeProjectsCount: number;
  atRiskProjectsCount: number;
  openGovTransactionsCount: number;
  awaitingResponseGovCount: number;
  repAttainments: { ownerId: string; attainment: number }[];
  commissionAccruing: number;
  generatedAt: string;
}
