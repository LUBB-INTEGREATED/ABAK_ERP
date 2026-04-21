export type AppLocale = 'ar' | 'en';
export type NumeralSystem = 'latin' | 'arabic-indic';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicIndic(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)] ?? d);
}

export interface FormatNumberOptions {
  locale?: AppLocale;
  numerals?: NumeralSystem;
  grouping?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatNumber(
  value: number,
  options: FormatNumberOptions = {},
): string {
  const {
    locale = 'en',
    numerals = 'latin',
    grouping = true,
    minimumFractionDigits,
    maximumFractionDigits,
  } = options;

  const intl = new Intl.NumberFormat(locale === 'ar' ? 'en-US' : 'en-US', {
    useGrouping: grouping,
    minimumFractionDigits,
    maximumFractionDigits,
  });
  const formatted = intl.format(value);
  return numerals === 'arabic-indic' ? toArabicIndic(formatted) : formatted;
}

export interface FormatCurrencyOptions extends FormatNumberOptions {
  currency?: 'SAR';
  showSymbol?: boolean;
}

const SAR_SYMBOL_AR = 'ر.س';
const SAR_SYMBOL_EN = 'SAR';

export function formatCurrency(
  value: number,
  options: FormatCurrencyOptions = {},
): string {
  const {
    locale = 'en',
    currency = 'SAR',
    showSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    ...rest
  } = options;

  const number = formatNumber(value, {
    locale,
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest,
  });
  if (!showSymbol) return number;
  const symbol =
    currency === 'SAR'
      ? locale === 'ar'
        ? SAR_SYMBOL_AR
        : SAR_SYMBOL_EN
      : currency;
  return locale === 'ar' ? `${number} ${symbol}` : `${symbol} ${number}`;
}

export interface FormatDateOptions {
  locale?: AppLocale;
  calendar?: 'gregorian' | 'hijri' | 'both';
  numerals?: NumeralSystem;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
}

export function formatDate(
  value: Date | string,
  options: FormatDateOptions = {},
): string {
  const {
    locale = 'en',
    calendar = 'gregorian',
    numerals = 'latin',
    dateStyle = 'medium',
  } = options;
  const date = typeof value === 'string' ? new Date(value) : value;

  const gregorian = new Intl.DateTimeFormat(
    locale === 'ar' ? 'en-GB' : 'en-GB',
    { dateStyle },
  ).format(date);

  const hijri = new Intl.DateTimeFormat(
    locale === 'ar'
      ? 'ar-SA-u-ca-islamic-umalqura'
      : 'en-GB-u-ca-islamic-umalqura',
    { dateStyle },
  ).format(date);

  const pick =
    calendar === 'gregorian'
      ? gregorian
      : calendar === 'hijri'
        ? hijri
        : `${gregorian} / ${hijri}`;

  return numerals === 'arabic-indic' ? toArabicIndic(pick) : pick;
}
