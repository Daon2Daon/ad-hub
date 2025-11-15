import type { ColumnKey, DataScope, Role } from "@/types/auth";

/**
 * 시스템 관리 페이지에서 사용하는 사용자 정보 타입
 */
export interface SystemUser {
  id: string;
  loginId: string;
  email: string | null;
  name: string | null;
  role: Role;
  status: "pending" | "active" | "suspended";
  createdAt: string;
  updatedAt: string;
  accessProfile: {
    columnPermissions: Record<ColumnKey, boolean>;
    departments: string[];
    agencies: string[];
  } | null;
}

/**
 * 권한 설정 폼 데이터 타입
 */
export interface PermissionFormData {
  columnPermissions: Record<ColumnKey, boolean>;
  scope: DataScope;
}

