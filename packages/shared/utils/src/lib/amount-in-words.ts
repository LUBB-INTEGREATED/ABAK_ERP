import type { AppLocale } from './format.js';

/**
 * Amount-in-words ("tafqit" / تفقيط) for SAR quote documents.
 *
 * Pure function of (value, currency, locale). NEVER persist the result —
 * totals recompute on every quote update, so a stored string would drift.
 * Compute at render time; freeze into the quote `renderManifest` only at send.
 *
 * Supports integers up to billions plus a 2-decimal halalas remainder.
 * Arabic uses the standard masculine financial form (hundreds: مائة / مئتان /
 * ثلاثمائة …; scale dual/plural: ألف / ألفان / آلاف; groups joined with " و").
 */

export type AmountCurrency = 'SAR';

export interface AmountInWordsOptions {
  locale?: AppLocale; // 'ar' | 'en' — default 'en'
  currency?: AmountCurrency; // default 'SAR'
  /** Append the closing "only / فقط لا غير" affirmation. Default true. */
  affirm?: boolean;
}

// ── English ────────────────────────────────────────────────────────────────

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function enTwo(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? EN_TENS[t] : `${EN_TENS[t]}-${EN_ONES[u]}`;
}

function enThree(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (r) parts.push(enTwo(r));
  return parts.join(' ');
}

function enInteger(value: number): string {
  if (value === 0) return 'zero';
  const groups: number[] = [];
  let n = value;
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const chunks: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    chunks.push(EN_SCALES[i] ? `${enThree(g)} ${EN_SCALES[i]}` : enThree(g));
  }
  return chunks.join(' ');
}

// ── Arabic ───────────────────────────────────────────────────────────────────

const AR_ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const AR_TENS = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];
const AR_HUNDREDS = [
  '',
  'مائة',
  'مئتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];
// scale word forms: [singular, dual, plural(3-10)]
const AR_SCALES: Array<[string, string, string] | null> = [
  null,
  ['ألف', 'ألفان', 'آلاف'],
  ['مليون', 'مليونان', 'ملايين'],
  ['مليار', 'ملياران', 'مليارات'],
  ['تريليون', 'تريليونان', 'تريليونات'],
];

function arTwo(n: number): string {
  if (n < 20) return AR_ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? AR_TENS[t] : `${AR_ONES[u]} و${AR_TENS[t]}`;
}

function arThree(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(AR_HUNDREDS[h]);
  if (r) parts.push(arTwo(r));
  return parts.join(' و');
}

/**
 * RV-21: construct-state (iḍāfa) form of a three-digit group when it directly
 * governs a following scale word. A trailing مئتان (exactly 200, remainder 0)
 * drops its nun → مئتا (e.g. مئتا ألف, مئتا مليون). When a remainder follows
 * (250 → مئتان وخمسون) the مئتان is no longer adjacent to the scale word, so it
 * keeps the nun.
 */
function arThreeConstruct(n: number): string {
  const base = arThree(n);
  return base === AR_HUNDREDS[2] ? base.slice(0, -1) : base;
}

function arGroup(g: number, scaleIndex: number): string {
  const scale = AR_SCALES[scaleIndex];
  if (!scale) return arThree(g);
  const [singular, dual, plural] = scale;
  if (g === 1) return singular;
  if (g === 2) return dual;
  if (g >= 3 && g <= 10) return `${arThreeConstruct(g)} ${plural}`;
  return `${arThreeConstruct(g)} ${singular}`;
}

function arInteger(value: number): string {
  if (value === 0) return 'صفر';
  const groups: number[] = [];
  let n = value;
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const chunks: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    chunks.push(arGroup(g, i));
  }
  return chunks.join(' و');
}

// ── Public API ───────────────────────────────────────────────────────────────

interface CurrencyWords {
  major: { ar: string; en: string };
  minor: { ar: string; en: string };
}

const CURRENCY_WORDS: Record<AmountCurrency, CurrencyWords> = {
  SAR: {
    major: { ar: 'ريال سعودي', en: 'Saudi Riyals' },
    minor: { ar: 'هللة', en: 'Halalas' },
  },
};

/** Split a positive amount into integer major units + rounded 2-digit minor units. */
function splitAmount(value: number): { major: number; minor: number } {
  const totalMinor = Math.round(Math.abs(value) * 100);
  return {
    major: Math.floor(totalMinor / 100),
    minor: totalMinor % 100,
  };
}

export function amountInWords(
  value: number,
  options: AmountInWordsOptions = {},
): string {
  const { locale = 'en', currency = 'SAR', affirm = true } = options;
  const words = CURRENCY_WORDS[currency];
  const negative = value < 0;
  const { major, minor } = splitAmount(value);

  if (locale === 'ar') {
    let out = `${arInteger(major)} ${words.major.ar}`;
    if (minor > 0) out += ` و${arTwo(minor)} ${words.minor.ar}`;
    if (negative) out = `سالب ${out}`;
    if (affirm) out += ' فقط لا غير';
    return out;
  }

  let out = `${enInteger(major)} ${words.major.en}`;
  if (minor > 0) out += ` and ${enTwo(minor)} ${words.minor.en}`;
  if (negative) out = `negative ${out}`;
  out = out.charAt(0).toUpperCase() + out.slice(1);
  if (affirm) out += ' only';
  return out;
}
