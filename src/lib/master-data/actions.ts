"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
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
  // 캠페인 데이터를 사용하는 다른 페이지들도 재검증
  revalidatePath("/dashboard");
  revalidatePath("/report");
}

/**
 * 마스터 데이터 카테고리에 따른 Campaign 필드 매핑
 */
const MASTER_DATA_TO_CAMPAIGN_FIELD: Record<MasterDataCategory, keyof Prisma.CampaignUpdateInput> = {
  campaign: "campaign",
  creative: "creative",
  channel: "channel",
  budgetAccount: "budgetAccount",
  department: "department",
  agency: "agency",
} as const;

/**
 * 마스터 데이터 수정 시 관련 Campaign 데이터도 함께 업데이트
 */
async function updateRelatedCampaigns(
  category: MasterDataCategory,
  oldValue: string,
  newValue: string,
): Promise<{ updatedCount: number }> {
  const field = MASTER_DATA_TO_CAMPAIGN_FIELD[category];

  const result = await prisma.campaign.updateMany({
    where: {
      [field]: oldValue,
    },
    data: {
      [field]: newValue,
    },
  });

  return { updatedCount: result.count };
}

/**
 * 마스터 데이터를 사용하는 Campaign이 있는지 확인
 */
async function hasRelatedCampaigns(category: MasterDataCategory, value: string): Promise<boolean> {
  const field = MASTER_DATA_TO_CAMPAIGN_FIELD[category];

  const count = await prisma.campaign.count({
    where: {
      [field]: value,
    },
  });

  return count > 0;
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
  .action(async ({ parsedInput }): Promise<{ item: MasterDataItem; updatedCampaigns: number }> => {
    const session = await getServerAuthSession();
    ensureAdmin(session);

    try {
      // 기존 마스터 데이터 조회 (업데이트 전 값 확인)
      const existing = await prisma.masterDataItem.findUnique({
        where: { id: parsedInput.id },
      });

      if (!existing) {
        throw new Error("대상을 찾을 수 없습니다.");
      }

      const oldValue = existing.value;
      const category = existing.category;

      // 트랜잭션으로 마스터 데이터 업데이트와 Campaign 업데이트를 함께 처리
      const result = await prisma.$transaction(async (tx) => {
        // 마스터 데이터 업데이트
        const updated = await tx.masterDataItem.update({
          where: { id: parsedInput.id },
          data: {
            value: parsedInput.value,
            updatedAt: new Date(),
          },
        });

        // 관련 Campaign 데이터 업데이트
        const field = MASTER_DATA_TO_CAMPAIGN_FIELD[category];
        const campaignUpdateResult = await tx.campaign.updateMany({
          where: {
            [field]: oldValue,
          },
          data: {
            [field]: parsedInput.value,
          },
        });

        return {
          item: {
            id: updated.id,
            category: updated.category as MasterDataCategory,
            value: updated.value,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
          updatedCampaigns: campaignUpdateResult.count,
        };
      });

      revalidateMasterDataPaths();
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("이미 존재하는 값으로 변경할 수 없습니다.");
        }
        if (error.code === "P2025") {
          throw new Error("대상을 찾을 수 없습니다.");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("마스터 데이터 수정에 실패했습니다.");
    }
  });

export const deleteMasterDataItemAction = actionClient
  .schema(deleteSchema)
  .action(async ({ parsedInput }): Promise<{ id: string }> => {
    const session = await getServerAuthSession();
    ensureAdmin(session);

    // 삭제 전에 해당 마스터 데이터 조회
    const existing = await prisma.masterDataItem.findUnique({
      where: { id: parsedInput.id },
    });

    if (!existing) {
      throw new Error("대상을 찾을 수 없습니다.");
    }

    // 해당 값을 사용하는 Campaign이 있는지 확인
    const hasCampaigns = await hasRelatedCampaigns(existing.category, existing.value);

    if (hasCampaigns) {
      const categoryLabels: Record<MasterDataCategory, string> = {
        campaign: "캠페인",
        creative: "소재",
        channel: "매체/구분",
        budgetAccount: "예산계정",
        department: "담당부서",
        agency: "대행사",
      };

      throw new Error(
        `이 ${categoryLabels[existing.category]} 값을 사용하는 캠페인이 있어 삭제할 수 없습니다. 먼저 관련 캠페인 데이터를 수정하거나 삭제해주세요.`,
      );
    }

    await deleteMasterDataItem(parsedInput.id);
    revalidateMasterDataPaths();
    return { id: parsedInput.id };
  });
