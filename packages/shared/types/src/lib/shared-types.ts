export type ID = string;

export type ISODateString = string;

export type UserId = ID;

export interface AuditTimestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy?: UserId;
  updatedBy?: UserId;
}
