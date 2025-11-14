import type { Role, User, UserAccessProfile as DbUserAccessProfile } from "@prisma/client";

import {
  COLUMN_KEYS,
  type ColumnKey,
  type ColumnPermissionMap,
  type DataScope,
  type UserAccessProfile,
} from "@/types/auth";
import { userAccessProfileSchema } from "@/lib/auth/schemas";

export function createColumnPermissionMap(allowedColumns: ColumnKey[]): ColumnPermissionMap {
  return COLUMN_KEYS.reduce<ColumnPermissionMap>(
    (acc, column) => ({
      ...acc,
      [column]: allowedColumns.includes(column),
    }),
    {} as ColumnPermissionMap,
  );
}

export function emptyColumnPermissionMap(): ColumnPermissionMap {
  return createColumnPermissionMap([]);
}

export function createDefaultAccessProfile(role: Role = "user"): UserAccessProfile {
  return {
    role,
    columnPermissions: emptyColumnPermissionMap(),
    scope: {
      departments: [],
      agencies: [],
    },
  };
}

type UserWithProfile = User & {
  accessProfile: DbUserAccessProfile | null;
};

export function toUserAccessProfile(user: UserWithProfile): UserAccessProfile {
  const columnPermissions =
    (user.accessProfile?.columnPermissions as ColumnPermissionMap | null) ??
    emptyColumnPermissionMap();

  const scope: DataScope = {
    departments: user.accessProfile?.departments ?? [],
    agencies: user.accessProfile?.agencies ?? [],
  };

  return userAccessProfileSchema.parse({
    role: user.role satisfies Role,
    columnPermissions,
    scope,
  });
}
