import { COLUMN_KEYS, type ColumnKey, type ScopedEntity, type UserAccessProfile } from "@/types/auth";

/**
 * 지정된 컬럼에 대한 접근 권한을 확인합니다.
 */
export function hasColumnAccess(profile: UserAccessProfile, column: ColumnKey): boolean {
  if (profile.role === "admin") {
    return true;
  }

  return profile.columnPermissions[column] ?? false;
}

/**
 * 사용자가 접근 가능한 컬럼 목록을 반환합니다.
 */
export function getVisibleColumns(profile: UserAccessProfile): ColumnKey[] {
  if (profile.role === "admin") {
    return COLUMN_KEYS;
  }

  return COLUMN_KEYS.filter((column) => profile.columnPermissions[column]);
}

/**
 * 특정 행이 사용자의 스코프 조건을 충족하는지 검사합니다.
 * Admin은 모든 데이터를 볼 수 있습니다.
 */
export function isRowVisible(profile: UserAccessProfile, entity: ScopedEntity): boolean {
  if (profile.role === "admin") {
    return true;
  }

  const matchesDepartment =
    profile.scope.departments.length === 0 ||
    profile.scope.departments.includes(entity.department);
  const matchesAgency =
    profile.scope.agencies.length === 0 || profile.scope.agencies.includes(entity.agency);

  return matchesDepartment && matchesAgency;
}

/**
 * 행 목록에서 사용자가 접근 가능한 항목만 남겨 반환합니다.
 */
export function filterRowsByScope<T extends ScopedEntity>(
  rows: T[],
  profile: UserAccessProfile,
): T[] {
  if (profile.role === "admin") {
    return rows;
  }

  return rows.filter((row) => isRowVisible(profile, row));
}

/**
 * 사용자가 접근할 수 없는 컬럼은 null 또는 지정된 마스킹 문자열로 대체합니다.
 */
export function maskColumns<T extends Record<string, unknown>>(
  row: T,
  profile: UserAccessProfile,
  options: { maskValue?: unknown } = {},
): T {
  if (profile.role === "admin") {
    return row;
  }

  const { maskValue = null } = options;
  const masked: Record<string, unknown> = { ...row };

  COLUMN_KEYS.forEach((column) => {
    if (!hasColumnAccess(profile, column) && column in masked) {
      masked[column] = maskValue;
    }
  });

  return masked as T;
}

