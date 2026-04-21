export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  type: SettingValueType;
  labelAr: string | null;
  labelEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  defaultValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  editableByRoles: string[];
  category: string | null;
  updatedAt: string;
  updatedById: string | null;
}

export interface SettingHistoryEntry {
  id: string;
  oldValue: string | null;
  newValue: string;
  changedById: string | null;
  changedAt: string;
}
