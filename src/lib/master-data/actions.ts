"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { actionClient } from "@/lib/safe-action";
import {
  createMasterDataItem,
  deleteMasterDataItem,
  updateMasterDataItem,
} from "@/lib/master-data/repository";
import type { MasterDataCategory, MasterDataItem } from "@/types/master-data";

const MASTERDATA_PATHS_TO_REVALIDATE = ["/masterdata", "/management", "/schedule"] as const;

const categorySchema = z.enum([
  "campaign",
  "creative",
  "channel",
  "budgetAccount",
  "department",
  "agency",
]);

const valueSchema = z
  .string()
  .trim()
  .min(1, "값을 입력해주세요.")
  .max(120, "최대 120자까지 입력할 수 있습니다.");

const createSchema = z.object({
  category: categorySchema,
  value: valueSchema,
});

const updateSchema = z.object({
  id: z.string().uuid("유효한 ID가 아닙니다."),
  value: valueSchema,
});

const deleteSchema = z.object({
  id: z.string().uuid("유효한 ID가 아닙니다."),
});

function ensureAdmin(session: Awaited<ReturnType<typeof getServerAuthSession>>) {
  if (!session) {
    throw new Error("로그인이 필요합니다.");
  }

  if (session.user.status !== "active") {
    throw new Error("승인된 사용자만 이용할 수 있습니다.");
  }

  const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);

  if (profile.role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return profile;
}

function revalidateMasterDataPaths() {
  MASTERDATA_PATHS_TO_REVALIDATE.forEach((path) => revalidatePath(path));
}

export const createMasterDataItemAction = actionClient
  .schema(createSchema)
  .action(async ({ parsedInput }): Promise<{ item: MasterDataItem }> => {
    const session = await getServerAuthSession();
    ensureAdmin(session);

    try {
      const item = await createMasterDataItem(parsedInput);
      revalidateMasterDataPaths();
      return { item };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("이미 존재하는 값입니다. 다른 값을 입력해주세요.");
      }
      throw error;
    }
  });

export const updateMasterDataItemAction = actionClient
  .schema(updateSchema)
  .action(async ({ parsedInput }): Promise<{ item: MasterDataItem }> => {
    const session = await getServerAuthSession();
    ensureAdmin(session);

    try {
      const item = await updateMasterDataItem(parsedInput);
      revalidateMasterDataPaths();
      return { item };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("이미 존재하는 값으로 변경할 수 없습니다.");
        }
        if (error.code === "P2025") {
          throw new Error("대상을 찾을 수 없습니다.");
        }
      }
      throw error;
    }
  });

export const deleteMasterDataItemAction = actionClient
  .schema(deleteSchema)
  .action(async ({ parsedInput }): Promise<{ id: string }> => {
    const session = await getServerAuthSession();
    ensureAdmin(session);

    await deleteMasterDataItem(parsedInput.id);
    revalidateMasterDataPaths();
    return { id: parsedInput.id };
  });

