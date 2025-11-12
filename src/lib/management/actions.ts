"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { actionClient } from "@/lib/safe-action";
import { mapCampaignModelToRecord } from "@/lib/schedule/utils";
import { prisma } from "@/lib/prisma";
import { buildManagementColumnAccess, toManagementRow } from "@/lib/management/utils";
import type { MasterDataCategory } from "@/types/master-data";
import type { UserAccessProfile } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";
import type { ManagementOptionValues, ManagementRow } from "@/types/management";

const MANAGEMENT_PATH = "/management";
const DASHBOARD_PATH = "/dashboard";
const SCHEDULE_PATH = "/schedule";

const DEFAULT_PLACEHOLDER = "미정";
const DEFAULT_BUDGET_ACCOUNT = "UNASSIGNED";

const createCampaignSchema = z
  .object({
    campaign: z.string().trim().min(1, "캠페인을 입력해주세요.").max(120),
    creative: z.string().trim().max(120).optional(),
    channel: z.string().trim().min(1, "매체/구분을 입력해주세요.").max(80),
    budgetAccount: z.string().trim().max(80).optional(),
    department: z.string().trim().min(1, "담당부서를 입력해주세요.").max(80),
    agency: z.string().trim().min(1, "대행사를 입력해주세요.").max(80),
    startDate: z.coerce.date({ message: "시작일을 선택해주세요." }),
    endDate: z.coerce.date({ message: "종료일을 선택해주세요." }),
    spend: z.coerce.number().min(0, "광고비는 0 이상이어야 합니다.").optional(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "시작일은 종료일보다 늦을 수 없습니다.",
    path: ["endDate"],
  });

const updateCampaignSchema = z
  .object({
    id: z.string().uuid("유효한 캠페인 ID가 아닙니다."),
    campaign: z.string().trim().min(1).max(120).optional(),
    creative: z.string().trim().max(120).optional(),
    channel: z.string().trim().min(1).max(80).optional(),
    budgetAccount: z.string().trim().max(80).optional(),
    department: z.string().trim().min(1).max(80).optional(),
    agency: z.string().trim().min(1).max(80).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    spend: z.coerce.number().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && !value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "종료일을 함께 입력해주세요.",
      });
    }

    if (!value.startDate && value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "시작일을 함께 입력해주세요.",
      });
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "시작일은 종료일보다 늦을 수 없습니다.",
      });
    }
  });

const bulkUpdateSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1, "선택된 캠페인이 없습니다."),
    department: z.string().trim().min(1).max(80).optional(),
    agency: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => Boolean(value.department ?? value.agency), {
    message: "변경할 항목을 최소 1개 이상 선택해주세요.",
    path: ["department"],
  });

const deleteCampaignSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "삭제할 캠페인을 선택해주세요."),
});

function ensureScopePermission(profile: UserAccessProfile, record: CampaignRecord) {
  if (profile.role === "admin") {
    return;
  }

  const { departments, agencies } = profile.scope;

  if (departments.length > 0 && !departments.includes(record.department)) {
    throw new Error("허용되지 않은 담당부서 데이터입니다.");
  }

  if (agencies.length > 0 && !agencies.includes(record.agency)) {
    throw new Error("허용되지 않은 대행사 데이터입니다.");
  }
}

function ensureNewScopePermission(
  profile: UserAccessProfile,
  values: { department?: string; agency?: string },
) {
  if (profile.role === "admin") {
    return;
  }

  const { departments, agencies } = profile.scope;

  if (values.department && departments.length > 0 && !departments.includes(values.department)) {
    throw new Error("허용되지 않은 담당부서입니다.");
  }

  if (values.agency && agencies.length > 0 && !agencies.includes(values.agency)) {
    throw new Error("허용되지 않은 대행사입니다.");
  }
}

function buildOptionValues(
  record: CampaignRecord,
  access: ReturnType<typeof buildManagementColumnAccess>,
): ManagementOptionValues {
  return {
    campaign: access.campaign ? record.campaign : null,
    creative: access.creative ? record.creative : null,
    channel: access.channel ? record.channel : null,
    budgetAccount: access.budgetAccount ? record.budgetAccount : null,
    department: access.department ? record.department : null,
    agency: access.agency ? record.agency : null,
  };
}

function revalidateManagementRelatedPaths() {
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SCHEDULE_PATH);
}

async function assertMasterDataValues(
  values: { category: MasterDataCategory; value: string | null | undefined; optional?: boolean }[],
) {
  const normalized = values
    .filter((entry) => !(entry.optional && !entry.value?.trim()))
    .map(({ category, value }) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        throw new Error("마스터 데이터에 등록된 값을 선택해주세요.");
      }
      return { category, value: trimmed };
    });

  if (normalized.length === 0) {
    return;
  }

  const found = await prisma.masterDataItem.findMany({
    where: {
      OR: normalized.map(({ category, value }) => ({ category, value })),
    },
    select: {
      category: true,
      value: true,
    },
  });

  const missing = normalized.filter(
    ({ category, value }) => !found.some((record) => record.category === category && record.value === value),
  );

  if (missing.length > 0) {
    throw new Error("마스터 데이터에 등록된 값이 아닙니다. 먼저 마스터 데이터에서 값을 추가해주세요.");
  }
}

export const createCampaignAction = actionClient
  .schema(createCampaignSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 데이터를 등록할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
    const columnAccess = buildManagementColumnAccess(profile);

    const requiredColumns: (keyof typeof columnAccess)[] = [
      "campaign",
      "channel",
      "schedule",
      "department",
      "agency",
      "budgetAccount",
      "spend",
    ];

    const missing = requiredColumns.filter((key) => !columnAccess[key]);

    if (missing.length > 0) {
      throw new Error("필수 컬럼 접근 권한이 없어 신규 등록을 진행할 수 없습니다.");
    }

    ensureNewScopePermission(profile, {
      department: parsedInput.department,
      agency: parsedInput.agency,
    });

    const creativeValue = columnAccess.creative
      ? parsedInput.creative?.trim() || DEFAULT_PLACEHOLDER
      : DEFAULT_PLACEHOLDER;
    const budgetAccountValue = parsedInput.budgetAccount?.trim() || DEFAULT_BUDGET_ACCOUNT;
    const channelValue = parsedInput.channel.trim();
    const departmentValue = parsedInput.department.trim();
    const agencyValue = parsedInput.agency.trim();

    await assertMasterDataValues([
      { category: "campaign", value: parsedInput.campaign },
      { category: "creative", value: parsedInput.creative, optional: true },
      { category: "channel", value: channelValue },
      { category: "budgetAccount", value: budgetAccountValue },
      { category: "department", value: departmentValue },
      { category: "agency", value: agencyValue },
    ]);

    const created = await prisma.campaign.create({
      data: {
        ownerId: session.user.id,
        campaign: parsedInput.campaign,
        creative: creativeValue,
        channel: channelValue,
        startDate: parsedInput.startDate,
        endDate: parsedInput.endDate,
        spend: new Prisma.Decimal(parsedInput.spend ?? 0),
        budgetAccount: budgetAccountValue,
        department: departmentValue,
        agency: agencyValue,
      },
    });

    const record = mapCampaignModelToRecord(created);
    ensureScopePermission(profile, record);

    const row = toManagementRow(record, columnAccess);
    const optionValues = buildOptionValues(record, columnAccess);

    revalidateManagementRelatedPaths();

    return {
      row,
      optionValues,
    };
  });

export const updateCampaignAction = actionClient
  .schema(updateCampaignSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 데이터를 수정할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
    const columnAccess = buildManagementColumnAccess(profile);

    const existing = await prisma.campaign.findUnique({ where: { id: parsedInput.id } });

    if (!existing) {
      throw new Error("캠페인을 찾을 수 없습니다.");
    }

    const existingRecord = mapCampaignModelToRecord(existing);
    ensureScopePermission(profile, existingRecord);

    ensureNewScopePermission(profile, {
      department: parsedInput.department ?? existingRecord.department,
      agency: parsedInput.agency ?? existingRecord.agency,
    });

    const data: Prisma.CampaignUpdateInput = {};

    if (parsedInput.campaign !== undefined) {
      if (!columnAccess.campaign) {
        throw new Error("캠페인 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "campaign", value: parsedInput.campaign }]);
      data.campaign = parsedInput.campaign;
    }

    if (parsedInput.creative !== undefined) {
      if (!columnAccess.creative) {
        throw new Error("소재 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "creative", value: parsedInput.creative, optional: true }]);
      data.creative = parsedInput.creative || DEFAULT_PLACEHOLDER;
    }

    if (parsedInput.channel !== undefined) {
      if (!columnAccess.channel) {
        throw new Error("매체/구분 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "channel", value: parsedInput.channel }]);
      data.channel = parsedInput.channel;
    }

    if (parsedInput.budgetAccount !== undefined) {
      if (!columnAccess.budgetAccount) {
        throw new Error("예산계정 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "budgetAccount", value: parsedInput.budgetAccount }]);
      data.budgetAccount = parsedInput.budgetAccount || DEFAULT_BUDGET_ACCOUNT;
    }

    if (parsedInput.department !== undefined) {
      if (!columnAccess.department) {
        throw new Error("담당부서 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "department", value: parsedInput.department }]);
      data.department = parsedInput.department;
    }

    if (parsedInput.agency !== undefined) {
      if (!columnAccess.agency) {
        throw new Error("대행사 컬럼을 수정할 권한이 없습니다.");
      }
      await assertMasterDataValues([{ category: "agency", value: parsedInput.agency }]);
      data.agency = parsedInput.agency;
    }

    if (parsedInput.startDate !== undefined && parsedInput.endDate !== undefined) {
      if (!columnAccess.schedule) {
        throw new Error("일정 컬럼을 수정할 권한이 없습니다.");
      }
      data.startDate = parsedInput.startDate;
      data.endDate = parsedInput.endDate;
    }

    if (parsedInput.spend !== undefined) {
      if (!columnAccess.spend) {
        throw new Error("광고비 컬럼을 수정할 권한이 없습니다.");
      }
      data.spend = new Prisma.Decimal(parsedInput.spend);
    }

    if (Object.keys(data).length === 0) {
      throw new Error("변경된 항목이 없습니다.");
    }

    const updated = await prisma.campaign.update({
      where: { id: parsedInput.id },
      data,
    });

    const updatedRecord = mapCampaignModelToRecord(updated);
    ensureScopePermission(profile, updatedRecord);

    const row = toManagementRow(updatedRecord, columnAccess);
    const optionValues = buildOptionValues(updatedRecord, columnAccess);

    revalidateManagementRelatedPaths();

    return {
      row,
      optionValues,
    };
  });

export const bulkUpdateCampaignsAction = actionClient
  .schema(bulkUpdateSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 데이터를 수정할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
    const columnAccess = buildManagementColumnAccess(profile);

    if (parsedInput.department && !columnAccess.department) {
      throw new Error("담당부서 컬럼을 일괄 수정할 권한이 없습니다.");
    }

    if (parsedInput.agency && !columnAccess.agency) {
      throw new Error("대행사 컬럼을 일괄 수정할 권한이 없습니다.");
    }

    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: parsedInput.ids } },
      orderBy: { createdAt: "asc" },
    });

    if (campaigns.length === 0) {
      throw new Error("선택한 캠페인을 찾을 수 없습니다.");
    }

    const records = campaigns.map((campaign) => mapCampaignModelToRecord(campaign));

    records.forEach((record) => {
      ensureScopePermission(profile, record);
    });

    ensureNewScopePermission(profile, {
      department: parsedInput.department,
      agency: parsedInput.agency,
    });

    await prisma.campaign.updateMany({
      where: { id: { in: parsedInput.ids } },
      data: {
        ...(parsedInput.department ? { department: parsedInput.department } : {}),
        ...(parsedInput.agency ? { agency: parsedInput.agency } : {}),
      },
    });

    const updated = await prisma.campaign.findMany({ where: { id: { in: parsedInput.ids } } });
    const updatedRecords = updated.map((campaign) => mapCampaignModelToRecord(campaign));

    updatedRecords.forEach((record) => {
      ensureScopePermission(profile, record);
    });

    const rows = updatedRecords.map((record) => toManagementRow(record, columnAccess));
    const optionValues = updatedRecords.reduce<ManagementOptionValues>(
      (acc, record) => mergeManagementOptionsValues(acc, buildOptionValues(record, columnAccess)),
      {
        campaign: null,
        creative: null,
        channel: null,
        budgetAccount: null,
        department: null,
        agency: null,
      },
    );

    revalidateManagementRelatedPaths();

    return {
      rows,
      optionValues,
    };
  });

export const deleteCampaignsAction = actionClient
  .schema(deleteCampaignSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 데이터를 삭제할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);

    const campaigns = await prisma.campaign.findMany({ where: { id: { in: parsedInput.ids } } });

    if (campaigns.length === 0) {
      throw new Error("선택한 캠페인이 존재하지 않습니다.");
    }

    campaigns.forEach((campaign) => {
      const record = mapCampaignModelToRecord(campaign);
      ensureScopePermission(profile, record);
    });

    await prisma.campaign.deleteMany({ where: { id: { in: parsedInput.ids } } });

    revalidateManagementRelatedPaths();

    return {
      ids: parsedInput.ids,
    };
  });

function mergeManagementOptionsValues(
  current: ManagementOptionValues,
  next: ManagementOptionValues,
): ManagementOptionValues {
  const merge = (value: string | null, incoming: string | null) => incoming ?? value;

  return {
    campaign: merge(current.campaign, next.campaign),
    creative: merge(current.creative, next.creative),
    channel: merge(current.channel, next.channel),
    budgetAccount: merge(current.budgetAccount, next.budgetAccount),
    department: merge(current.department, next.department),
    agency: merge(current.agency, next.agency),
  };
}

export type CreateCampaignResult = {
  row: ManagementRow;
  optionValues: ManagementOptionValues;
};

export type UpdateCampaignResult = {
  row: ManagementRow;
  optionValues: ManagementOptionValues;
};

export type BulkUpdateCampaignResult = {
  rows: ManagementRow[];
  optionValues: ManagementOptionValues;
};

export type DeleteCampaignResult = {
  ids: string[];
};
