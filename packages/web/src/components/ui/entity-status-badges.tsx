'use client';

import { useTranslations } from 'next-intl';
import { StatusBadge, type StatusBadgeProps } from './status-badge';
import type {
  ClientClassification,
  ClientStatus,
  FollowUpStatus,
} from '@/lib/types/client';
import type { GovTxStatus } from '@/lib/types/gov';
import type { LeadPriority, LeadStatus, SLAStatus } from '@/lib/types/lead';
import type {
  PhaseStatus,
  ProjectStatus,
  TaskStatus,
} from '@/lib/types/project';
import type { QuoteStatus } from '@/lib/types/quote';
import type { RfqPriority, RfqStatus } from '@/lib/types/rfq';
import type { InvoiceStatus } from '@/lib/types/finance';
import {
  clientClassificationVariant,
  clientStatusVariant,
  followUpStatusVariant,
  govTxStatusVariant,
  invoiceStatusVariant,
  leadPriorityVariant,
  leadStatusVariant,
  phaseStatusVariant,
  projectStatusVariant,
  quoteStatusVariant,
  rfqPriorityVariant,
  rfqStatusVariant,
  slaStatusVariant,
  taskStatusVariant,
} from '@/lib/status-tones';

/**
 * Typed badges that bind a status enum to its variant + i18n label in one shot.
 *
 * Pages should prefer these over hand-rolled <StatusBadge variant=… label=… />,
 * so that changes to the mapping or the label live in exactly one place.
 *
 * See DESIGN_SYSTEM_MASTER.md §2 for the 5-token semantic model.
 */
type EntityProps = Omit<StatusBadgeProps, 'variant' | 'label'>;

export function QuoteStatusBadge({
  status,
  ...rest
}: { status: QuoteStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={quoteStatusVariant(status)}
      label={t(`quote.status.${status}`)}
      {...rest}
    />
  );
}

export function RfqStatusBadge({
  status,
  ...rest
}: { status: RfqStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={rfqStatusVariant(status)}
      label={t(`rfq.status.${status}`)}
      {...rest}
    />
  );
}

export function RfqPriorityBadge({
  priority,
  ...rest
}: { priority: RfqPriority } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={rfqPriorityVariant(priority)}
      label={t(`rfq.priorityLabel.${priority}`)}
      {...rest}
    />
  );
}

export function ProjectStatusBadge({
  status,
  ...rest
}: { status: ProjectStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={projectStatusVariant(status)}
      label={t(`project.status.${status}`)}
      {...rest}
    />
  );
}

export function PhaseStatusBadge({
  status,
  ...rest
}: { status: PhaseStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={phaseStatusVariant(status)}
      label={t(`phase.status.${status}`)}
      {...rest}
    />
  );
}

export function TaskStatusBadge({
  status,
  ...rest
}: { status: TaskStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={taskStatusVariant(status)}
      label={t(`task.status.${status}`)}
      {...rest}
    />
  );
}

export function ClientStatusBadge({
  status,
  ...rest
}: { status: ClientStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={clientStatusVariant(status)}
      label={t(`client.status.${status}`)}
      {...rest}
    />
  );
}

export function ClientClassificationBadge({
  classification,
  ...rest
}: { classification: ClientClassification } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={clientClassificationVariant(classification)}
      label={t(`client.classification.${classification}`)}
      {...rest}
    />
  );
}

export function FollowUpStatusBadge({
  status,
  ...rest
}: { status: FollowUpStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={followUpStatusVariant(status)}
      label={t(`followUp.status.${status}`)}
      {...rest}
    />
  );
}

export function LeadStatusBadge({
  status,
  ...rest
}: { status: LeadStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={leadStatusVariant(status)}
      label={t(`lead.status.${status}`)}
      {...rest}
    />
  );
}

export function LeadPriorityBadge({
  priority,
  ...rest
}: { priority: LeadPriority } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={leadPriorityVariant(priority)}
      label={t(`lead.priority.${priority}`)}
      {...rest}
    />
  );
}

export function SlaStatusBadge({
  status,
  ...rest
}: { status: SLAStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={slaStatusVariant(status)}
      label={t(`lead.sla.${status}`)}
      {...rest}
    />
  );
}

export function GovTxStatusBadge({
  status,
  ...rest
}: { status: GovTxStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={govTxStatusVariant(status)}
      label={t(`gov.status.${status}`)}
      {...rest}
    />
  );
}

export function InvoiceStatusBadge({
  status,
  ...rest
}: { status: InvoiceStatus } & EntityProps) {
  const t = useTranslations();
  return (
    <StatusBadge
      variant={invoiceStatusVariant(status)}
      label={t(`finance.invoice.status.${status}`)}
      {...rest}
    />
  );
}
