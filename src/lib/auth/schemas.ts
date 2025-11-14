import { z } from "zod";

import { COLUMN_KEYS, ROLES } from "@/types/auth";

export const columnKeySchema = z.enum(
  COLUMN_KEYS as [(typeof COLUMN_KEYS)[number], ...(typeof COLUMN_KEYS)[number][]],
);
export const roleSchema = z.enum(ROLES as [(typeof ROLES)[number], ...(typeof ROLES)[number][]]);

const columnPermissionSchema = z.object(
  Object.fromEntries(COLUMN_KEYS.map((column) => [column, z.boolean()])) as Record<
    (typeof COLUMN_KEYS)[number],
    z.ZodBoolean
  >,
);

export const dataScopeSchema = z.object({
  departments: z.array(z.string()).default([]),
  agencies: z.array(z.string()).default([]),
});

export const userAccessProfileSchema = z.object({
  role: roleSchema,
  columnPermissions: columnPermissionSchema,
  scope: dataScopeSchema,
});

export type RoleSchema = z.infer<typeof roleSchema>;
export type ColumnKeySchema = z.infer<typeof columnKeySchema>;
export type UserAccessProfileSchema = z.infer<typeof userAccessProfileSchema>;
