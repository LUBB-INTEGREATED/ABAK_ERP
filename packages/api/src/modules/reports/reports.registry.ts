import type { ReportDefinition } from './report-definition.interface';
import { salesDefinitions } from './definitions/sales.definitions';
import { rfqDefinitions } from './definitions/rfq.definitions';
import { projectDefinitions } from './definitions/project.definitions';
import { financeDefinitions } from './definitions/finance.definitions';
import { govDefinitions } from './definitions/gov.definitions';
import { slaDefinitions } from './definitions/sla.definitions';
import { bpdDefinitions } from './definitions/bpd.definitions';

const all: ReportDefinition[] = [
  ...salesDefinitions,
  ...rfqDefinitions,
  ...projectDefinitions,
  ...financeDefinitions,
  ...govDefinitions,
  ...slaDefinitions,
  ...bpdDefinitions,
];

export const REPORT_REGISTRY = new Map<string, ReportDefinition>(
  all.map((d) => [d.code, d]),
);
