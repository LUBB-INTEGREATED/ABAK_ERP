export type PreferredLanguage = 'ar' | 'en';
export type CalendarDisplay = 'GREGORIAN' | 'HIJRI' | 'BOTH';
export type NumeralSystem = 'LATIN' | 'ARABIC_INDIC';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  status: string;
  preferredLanguage: PreferredLanguage;
  calendarDisplay: CalendarDisplay;
  numeralSystem: NumeralSystem;
  timezone: string;
  notificationQuietHoursStart: number | null;
  notificationQuietHoursEnd: number | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  preferredLanguage?: PreferredLanguage;
  calendarDisplay?: CalendarDisplay;
  numeralSystem?: NumeralSystem;
  timezone?: string;
  notificationQuietHoursStart?: number;
  notificationQuietHoursEnd?: number;
}
