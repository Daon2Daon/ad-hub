"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { requireActiveSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { actionClient } from "@/lib/safe-action";
import { logDataDelete, logDataUpdate } from "@/lib/logs/logger";
import {
  columnKeySchema,
  dataScopeSchema,
} from "@/lib/auth/schemas";
import type { SystemUser } from "@/types/system";
import type { ColumnKey } from "@/types/auth";

async function requireAdminSession() {
  const session = await requireActiveSession();

  if (session.user.role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return session;
}

/**
 * 비밀번호 변경 스키마
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Za-z]/, "비밀번호에 영문이 포함되어야 합니다.")
      .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

/**
 * 자신의 비밀번호를 변경합니다.
 */
export const changePasswordAction = actionClient
  .schema(changePasswordSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireActiveSession();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const isValid = await verifyPassword(parsedInput.currentPassword, user.passwordHash);

    if (!isValid) {
      throw new Error("현재 비밀번호가 올바르지 않습니다.");
    }

    const newPasswordHash = await hashPassword(parsedInput.newPassword);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    });

    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "사용자",
      session.user.id,
      "비밀번호 변경",
    );

    revalidatePath("/system");
    return { success: true };
  });

/**
 * 사용자 목록 조회 스키마
 */
const getUserListSchema = z.object({
  status: z.enum(["pending", "active", "suspended"]).optional(),
});

/**
 * 서버 컴포넌트에서 직접 사용할 수 있는 사용자 목록 조회 함수 (Admin 전용)
 */
export async function getUserList(
  status?: "pending" | "active" | "suspended",
): Promise<SystemUser[]> {
  await requireAdminSession();

  const where = status ? { status } : {};

  const users = await prisma.user.findMany({
    where,
    include: {
      accessProfile: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const systemUsers: SystemUser[] = users.map((user) => {
    const columnPermissions =
      (user.accessProfile?.columnPermissions as Record<ColumnKey, boolean> | null) ??
      createDefaultAccessProfile(user.role).columnPermissions;

    return {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      accessProfile: {
        columnPermissions,
        departments: user.accessProfile?.departments ?? [],
        agencies: user.accessProfile?.agencies ?? [],
      },
    };
  });

  return systemUsers;
}

/**
 * 사용자 목록을 조회합니다. (Admin 전용) - 클라이언트 액션용
 */
export const getUserListAction = actionClient
  .schema(getUserListSchema)
  .action(async ({ parsedInput }): Promise<{ users: SystemUser[] }> => {
    const users = await getUserList(parsedInput.status);
    return { users };
  });

/**
 * 사용자 승인/거절 스키마
 */
const approveUserSchema = z.object({
  userId: z.string().uuid("유효한 사용자 ID가 아닙니다."),
  action: z.enum(["approve", "reject"]),
});

/**
 * 사용자 가입을 승인하거나 거절합니다. (Admin 전용)
 */
export const approveUserAction = actionClient
  .schema(approveUserSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireAdminSession();

    const user = await prisma.user.findUnique({
      where: { id: parsedInput.userId },
      select: { id: true, loginId: true, status: true },
    });

    if (!user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    if (user.status !== "pending") {
      throw new Error("승인 대기 상태인 사용자만 처리할 수 있습니다.");
    }

    const newStatus = parsedInput.action === "approve" ? "active" : "suspended";

    await prisma.user.update({
      where: { id: parsedInput.userId },
      data: { status: newStatus },
    });

    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "사용자",
      parsedInput.userId,
      parsedInput.action === "approve" ? "가입 승인" : "가입 거절",
    );

    revalidatePath("/system");

    // 승인된 경우 승인된 사용자 정보를 반환하여 클라이언트에서 목록 업데이트 가능하도록
    if (parsedInput.action === "approve") {
      const approvedUser = await prisma.user.findUnique({
        where: { id: parsedInput.userId },
        include: {
          accessProfile: true,
        },
      });

      if (approvedUser) {
        const columnPermissions =
          (approvedUser.accessProfile?.columnPermissions as Record<ColumnKey, boolean> | null) ??
          createDefaultAccessProfile(approvedUser.role).columnPermissions;

        const systemUser: SystemUser = {
          id: approvedUser.id,
          loginId: approvedUser.loginId,
          email: approvedUser.email,
          name: approvedUser.name,
          role: approvedUser.role,
          status: approvedUser.status,
          createdAt: approvedUser.createdAt.toISOString(),
          updatedAt: approvedUser.updatedAt.toISOString(),
          accessProfile: {
            columnPermissions,
            departments: approvedUser.accessProfile?.departments ?? [],
            agencies: approvedUser.accessProfile?.agencies ?? [],
          },
        };

        return { success: true, userId: parsedInput.userId, status: newStatus, user: systemUser };
      }
    }

    return { success: true, userId: parsedInput.userId, status: newStatus };
  });

/**
 * 비밀번호 재설정 스키마
 */
const resetPasswordSchema = z.object({
  userId: z.string().uuid("유효한 사용자 ID가 아닙니다."),
  newPassword: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[A-Za-z]/, "비밀번호에 영문이 포함되어야 합니다.")
    .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다."),
});

/**
 * 사용자의 비밀번호를 강제로 재설정합니다. (Admin 전용)
 */
export const resetPasswordAction = actionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireAdminSession();

    const targetUser = await prisma.user.findUnique({
      where: { id: parsedInput.userId },
      select: { id: true, loginId: true },
    });

    if (!targetUser) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const newPasswordHash = await hashPassword(parsedInput.newPassword);

    await prisma.user.update({
      where: { id: parsedInput.userId },
      data: { passwordHash: newPasswordHash },
    });

    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "사용자",
      parsedInput.userId,
      `비밀번호 재설정 (대상: ${targetUser.loginId})`,
    );

    revalidatePath("/system");
    return { success: true, userId: parsedInput.userId };
  });

/**
 * 권한 설정 스키마
 */
const updatePermissionsSchema = z.object({
  userId: z.string().uuid("유효한 사용자 ID가 아닙니다."),
  columnPermissions: z.record(columnKeySchema, z.boolean()),
  scope: dataScopeSchema,
});

/**
 * 사용자의 권한을 설정합니다. (Admin 전용)
 */
export const updatePermissionsAction = actionClient
  .schema(updatePermissionsSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireAdminSession();

    const targetUser = await prisma.user.findUnique({
      where: { id: parsedInput.userId },
      select: { id: true, loginId: true, accessProfile: true },
    });

    if (!targetUser) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    // UserAccessProfile이 없으면 생성, 있으면 업데이트
    if (targetUser.accessProfile) {
      await prisma.userAccessProfile.update({
        where: { userId: parsedInput.userId },
        data: {
          columnPermissions: parsedInput.columnPermissions,
          departments: parsedInput.scope.departments,
          agencies: parsedInput.scope.agencies,
        },
      });
    } else {
      await prisma.userAccessProfile.create({
        data: {
          userId: parsedInput.userId,
          columnPermissions: parsedInput.columnPermissions,
          departments: parsedInput.scope.departments,
          agencies: parsedInput.scope.agencies,
        },
      });
    }

    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "사용자 권한",
      parsedInput.userId,
      `권한 설정 변경 (대상: ${targetUser.loginId})`,
    );

    revalidatePath("/system");
    return { success: true, userId: parsedInput.userId };
  });

/**
 * 사용자 삭제 스키마
 */
const deleteUserSchema = z.object({
  userId: z.string().uuid("유효한 사용자 ID가 아닙니다."),
});

/**
 * 사용자를 삭제합니다. (Admin 전용)
 * 관련 데이터는 Prisma의 Cascade 설정에 따라 자동으로 삭제됩니다.
 */
export const deleteUserAction = actionClient
  .schema(deleteUserSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireAdminSession();

    const targetUser = await prisma.user.findUnique({
      where: { id: parsedInput.userId },
      select: { id: true, loginId: true, role: true },
    });

    if (!targetUser) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    // 자기 자신은 삭제할 수 없음
    if (targetUser.id === session.user.id) {
      throw new Error("자기 자신은 삭제할 수 없습니다.");
    }

    // 마지막 admin은 삭제할 수 없음
    if (targetUser.role === "admin") {
      const adminCount = await prisma.user.count({
        where: { role: "admin", status: "active" },
      });

      if (adminCount <= 1) {
        throw new Error("마지막 관리자는 삭제할 수 없습니다.");
      }
    }

    // 사용자 삭제 (Cascade로 관련 데이터 자동 삭제)
    await prisma.user.delete({
      where: { id: parsedInput.userId },
    });

    // 삭제 로그 기록
    await logDataDelete(
      session.user.id,
      session.user.loginId,
      "사용자",
      [parsedInput.userId],
      `사용자 삭제 (대상: ${targetUser.loginId})`,
    );

    revalidatePath("/system");
    return { success: true, userId: parsedInput.userId, loginId: targetUser.loginId };
  });

