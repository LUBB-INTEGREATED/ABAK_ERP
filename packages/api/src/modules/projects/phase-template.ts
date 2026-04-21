import { PhaseCode } from '@prisma/client';

/**
 * Doc PART 4 § Core Phases — the seven canonical phases that every project
 * starts with. Durations are suggestions; PM can adjust after creation.
 */
export interface PhaseTemplateEntry {
  name: string;
  nameAr: string;
  phaseCode: PhaseCode;
  position: number;
  durationDays: number;
  evidenceRequired: boolean;
}

export const DEFAULT_PHASE_TEMPLATE: PhaseTemplateEntry[] = [
  {
    name: 'Initiation',
    nameAr: 'الانطلاق',
    phaseCode: PhaseCode.INITIATION,
    position: 0,
    durationDays: 7,
    evidenceRequired: true,
  },
  {
    name: 'Kickoff',
    nameAr: 'الانطلاقة مع العميل',
    phaseCode: PhaseCode.KICKOFF,
    position: 1,
    durationDays: 5,
    evidenceRequired: true,
  },
  {
    name: 'Execution',
    nameAr: 'التنفيذ',
    phaseCode: PhaseCode.EXECUTION,
    position: 2,
    durationDays: 45,
    evidenceRequired: true,
  },
  {
    name: 'Review',
    nameAr: 'المراجعة الداخلية',
    phaseCode: PhaseCode.REVIEW,
    position: 3,
    durationDays: 10,
    evidenceRequired: true,
  },
  {
    name: 'Submission',
    nameAr: 'التسليم',
    phaseCode: PhaseCode.SUBMISSION,
    position: 4,
    durationDays: 7,
    evidenceRequired: true,
  },
  {
    name: 'Revisions',
    nameAr: 'التعديلات',
    phaseCode: PhaseCode.REVISIONS,
    position: 5,
    durationDays: 14,
    evidenceRequired: true,
  },
  {
    name: 'Closure',
    nameAr: 'الإغلاق',
    phaseCode: PhaseCode.CLOSURE,
    position: 6,
    durationDays: 7,
    evidenceRequired: true,
  },
];
