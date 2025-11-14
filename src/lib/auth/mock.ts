import { COLUMN_KEYS, type DataScope, type Role, type UserAccessProfile } from "@/types/auth";
import { createColumnPermissionMap } from "@/lib/auth/profile";
import { userAccessProfileSchema } from "@/lib/auth/schemas";

/**
 * 사용자 접근 프로필을 생성하고 스키마로 검증합니다.
 */
export function createAccessProfile(params: {
  role: Role;
  allowedColumns?: Parameters<typeof createColumnPermissionMap>[0];
  scope?: Partial<DataScope>;
}): UserAccessProfile {
  const { role, allowedColumns = COLUMN_KEYS, scope } = params;

  const profile: UserAccessProfile = {
    role,
    columnPermissions: createColumnPermissionMap(allowedColumns),
    scope: {
      departments: scope?.departments ?? [],
      agencies: scope?.agencies ?? [],
    },
  };

  return userAccessProfileSchema.parse(profile);
}

export const MOCK_ADMIN_PROFILE = createAccessProfile({ role: "admin" });

export const MOCK_RESTRICTED_USER_PROFILE = createAccessProfile({
  role: "user",
  allowedColumns: ["campaign", "creative", "channel", "schedule", "department"],
  scope: {
    departments: ["A부서"],
    agencies: ["A대행사"],
  },
});
