'use client';

import { useTranslations } from 'next-intl';

type EnumNamespace =
  | 'clientType'
  | 'clientStatus'
  | 'clientClassification'
  | 'visitType'
  | 'interactionType'
  | 'interactionDirection'
  | 'followUpStatus'
  | 'followUpType'
  | 'noteTag'
  | 'closeOutcome'
  | 'pipelineStage'
  | 'interestLevel'
  | 'qualificationCriterion'
  | 'period'
  | 'targetMetric'
  | 'quoteStatus'
  | 'leadStatus'
  | 'leadChannel'
  | 'leadPriority';

export function useEnumLabels() {
  const t = useTranslations('enums');
  return (ns: EnumNamespace, key: string | null | undefined): string => {
    if (!key) return '';
    try {
      return t(`${ns}.${key}` as never);
    } catch {
      return key;
    }
  };
}

export function useEnumLabel(ns: EnumNamespace) {
  const t = useTranslations('enums');
  return (key: string | null | undefined): string => {
    if (!key) return '';
    try {
      return t(`${ns}.${key}` as never);
    } catch {
      return key;
    }
  };
}
