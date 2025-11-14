/**
 * 사용자 역할(role) 정의입니다.
 * Admin은 전체 데이터 접근, User는 권한에 따라 제한된 접근을 가집니다.
 */
export type Role = "admin" | "user";

export const ROLES: Role[] = ["admin", "user"];

/**
 * 컬럼 권한 제어에 사용되는 컬럼 키입니다.
 * 실제 화면에서 노출되는 컬럼(캠페인, 소재 등)에 대응합니다.
 */
export type ColumnKey =
  | "campaign"
  | "creative"
  | "channel"
  | "schedule"
  | "spend"
  | "budgetAccount"
  | "department"
  | "agency";

export const COLUMN_KEYS: ColumnKey[] = [
  "campaign",
  "creative",
  "channel",
  "schedule",
  "spend",
  "budgetAccount",
  "department",
  "agency",
];

/**
 * 사용자별 컬럼 접근 권한 정보입니다.
 * true이면 해당 컬럼을 조회할 수 있고, false이면 마스킹 대상입니다.
 */
export type ColumnPermissionMap = Record<ColumnKey, boolean>;

/**
 * 행(Row) 레벨 보안을 위한 스코프 정보입니다.
 * 담당부서와 대행사 값이 일치하는 데이터만 접근할 수 있습니다.
 */
export interface DataScope {
  departments: string[];
  agencies: string[];
}

/**
 * 사용자별 데이터 접근 프로필입니다.
 * 컬럼 허용 여부와 스코프 조건을 포함합니다.
 */
export interface UserAccessProfile {
  role: Role;
  columnPermissions: ColumnPermissionMap;
  scope: DataScope;
}

/**
 * 스코프 기반 필터링을 적용할 수 있는 데이터 엔터티가 구현해야 하는 최소 필드입니다.
 */
export interface ScopedEntity {
  department: string;
  agency: string;
}
