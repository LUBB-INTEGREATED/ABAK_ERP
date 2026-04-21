import { formatEntityId } from './shared-utils.js';

export type EntityPrefix = 'LEAD' | 'CLIENT' | 'QUO' | 'PO';

export function nextEntityNumber(
  prefix: EntityPrefix,
  lastNumber: string | null | undefined,
  now: Date = new Date(),
): string {
  const year = now.getFullYear();

  if (!lastNumber) {
    return formatEntityId(prefix, year, 1);
  }

  const parts = lastNumber.split('-');
  if (parts.length !== 3 || parts[0] !== prefix) {
    throw new Error(
      `Invalid ${prefix} number: "${lastNumber}". Expected ${prefix}-YYYY-XXXX.`,
    );
  }

  const lastYear = Number(parts[1]);
  const lastSequence = Number(parts[2]);

  if (!Number.isInteger(lastYear) || !Number.isInteger(lastSequence)) {
    throw new Error(
      `Invalid ${prefix} number: "${lastNumber}". Year and sequence must be integers.`,
    );
  }

  if (year > lastYear) {
    return formatEntityId(prefix, year, 1);
  }

  return formatEntityId(prefix, lastYear, lastSequence + 1);
}
