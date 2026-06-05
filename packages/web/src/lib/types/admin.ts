import type { PermissionScope } from './profile';

export type { PermissionScope };

export type DeptType =
  | 'TECHNICAL'
  | 'SALES'
  | 'FINANCE'
  | 'HR'
  | 'EXECUTIVE'
  | 'SUPPORT';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type LegacyRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SALES_MANAGER'
  | 'SALES_REPRESENTATIVE'
  | 'TECHNICAL_MANAGER'
  | 'FINANCE_MANAGER'
  | 'PRO'
  | 'VIEWER';

export interface RoleRef {
  id: string;
  name: string;
  nameAr: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: LegacyRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  department: { id: string; name: string; nameAr: string | null } | null;
  roles: RoleRef[];
  managesDepartmentId?: string | null;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId?: string;
  roleIds?: string[];
  status?: UserStatus;
  legacyRole?: LegacyRole;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  departmentId?: string | null;
  status?: UserStatus;
  legacyRole?: LegacyRole;
}

export interface RolePermissionEntry {
  key: string;
  scope: PermissionScope;
}

export interface Role {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  isSystem: boolean;
  isAssignable: boolean;
  assignmentCount: number;
  permissions: RolePermissionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionCatalogEntry {
  key: string;
  module: string;
  action: string;
  description: string | null;
  scopeable: boolean;
}

export interface PermissionCatalogGroup {
  module: string;
  permissions: PermissionCatalogEntry[];
}

export interface Department {
  id: string;
  name: string;
  nameAr: string | null;
  type: DeptType;
  isActive: boolean;
  order: number;
  managerId: string | null;
  manager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  memberCount: number;
  serviceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentPayload {
  name: string;
  nameAr?: string;
  type: DeptType;
  order?: number;
}

export interface UpdateDepartmentPayload {
  name?: string;
  nameAr?: string;
  type?: DeptType;
  isActive?: boolean;
  order?: number;
  managerId?: string | null;
}
