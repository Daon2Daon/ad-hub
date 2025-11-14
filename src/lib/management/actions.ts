"use server";

import { Prisma, type Campaign } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { logDataCreate, logDataDelete, logDataUpdate, logExcelUpload } from "@/lib/logs/logger";
import { actionClient } from "@/lib/safe-action";
import { mapCampaignModelToRecord } from "@/lib/schedule/utils";
import { prisma } from "@/lib/prisma";
import {
  buildManagementColumnAccess,
  toManagementRow,
  buildOptionValues,
} from "@/lib/management/utils";
import {
  parseCsvFile,
  createTemplateHeaders,
  parseCampaignRow,
  type ParsedCampaignRow,
} from "@/lib/management/csv";
import { MASTER_DATA_CATEGORY_LABELS, MAX_CSV_FILE_SIZE } from "@/lib/management/constants";
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

function revalidateManagementRelatedPaths() {
  revalidatePath(MANAGEMENT_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SCHEDULE_PATH);
}

/**
 * 마스터 데이터 값들을 일괄 생성 (이미 존재하는 값은 건너뛰기)
 * 트랜잭션을 사용하여 일관성 보장
 */
async function createMasterDataValuesBatch(
  values: Array<{ category: MasterDataCategory; value: string }>,
): Promise<Array<{ category: MasterDataCategory; value: string }>> {
  if (values.length === 0) {
    return [];
  }

  // 먼저 이미 존재하는 값들을 확인
  const trimmedValues = values.map(({ category, value }) => ({
    category,
    value: value.trim(),
  }));

  const existing = await prisma.masterDataItem.findMany({
    where: {
      OR: trimmedValues.map(({ category, value }) => ({ category, value })),
    },
    select: {
      category: true,
      value: true,
    },
  });

  // 존재하지 않는 값들만 필터링
  const toCreate = trimmedValues.filter(
    ({ category, value }) =>
      !existing.some((record) => record.category === category && record.value === value),
  );

  if (toCreate.length === 0) {
    return [];
  }

  // 트랜잭션으로 일괄 생성 시도
  const created: Array<{ category: MasterDataCategory; value: string }> = [];

  try {
    // createMany는 unique constraint violation을 일부 DB에서 지원하지 않으므로
    // 개별 create를 사용하되, 트랜잭션으로 묶어 일관성 보장
    await prisma.$transaction(
      toCreate.map(({ category, value }) =>
        prisma.masterDataItem
          .create({
            data: {
              category,
              value,
            },
          })
          .then((item) => {
            created.push({ category, value: item.value });
          })
          .catch((error) => {
            // 동시성 문제로 인한 중복 생성 시도는 무시
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
              return;
            }
            throw error;
          }),
      ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  } catch (error) {
    // 트랜잭션 실패 시 개별 처리로 폴백
    for (const { category, value } of toCreate) {
      try {
        const item = await prisma.masterDataItem.create({
          data: {
            category,
            value,
          },
        });
        created.push({ category, value: item.value });
      } catch (itemError) {
        // 중복 생성 시도는 무시 (동시성 문제로 인한 P2002 에러)
        if (
          itemError instanceof Prisma.PrismaClientKnownRequestError &&
          itemError.code === "P2002"
        ) {
          continue;
        }
        throw itemError;
      }
    }
  }

  return created;
}

async function assertMasterDataValues(
  values: { category: MasterDataCategory; value: string | null | undefined; optional?: boolean }[],
  options?: { autoCreate?: boolean; userId?: string; isAdmin?: boolean },
): Promise<{ autoCreated: Array<{ category: MasterDataCategory; value: string }> }> {
  const autoCreated: Array<{ category: MasterDataCategory; value: string }> = [];

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
    return { autoCreated };
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
    ({ category, value }) =>
      !found.some((record) => record.category === category && record.value === value),
  );

  if (missing.length > 0) {
    // 자동 생성 옵션이 활성화되어 있고 admin인 경우
    if (options?.autoCreate && options?.isAdmin && options?.userId) {
      // 누락된 값들을 일괄 생성
      try {
        const created = await createMasterDataValuesBatch(missing);
        autoCreated.push(...created);
      } catch (error) {
        const missingDetails = missing
          .map(({ category, value }) => `${MASTER_DATA_CATEGORY_LABELS[category]}: "${value}"`)
          .join(", ");

        throw new Error(
          `마스터 데이터 자동 등록에 실패했습니다: ${missingDetails}. ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    } else {
      // 자동 생성 불가능한 경우 기존 에러 메시지
      const missingDetails = missing
        .map(({ category, value }) => `${MASTER_DATA_CATEGORY_LABELS[category]}: "${value}"`)
        .join(", ");

      // 일반 사용자인 경우 관리자 요청 안내
      const errorMessage = `마스터 데이터에 등록되지 않은 값이 있습니다: ${missingDetails}. 관리자에게 요청하거나 마스터 데이터에서 먼저 추가해주세요.`;

      throw new Error(errorMessage);
    }
  }

  return { autoCreated };
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

    // 마스터 데이터 검증 및 자동 생성 (Admin인 경우)
    const { autoCreated } = await assertMasterDataValues(
      [
        { category: "campaign", value: parsedInput.campaign },
        { category: "creative", value: parsedInput.creative, optional: true },
        { category: "channel", value: channelValue },
        { category: "budgetAccount", value: budgetAccountValue },
        { category: "department", value: departmentValue },
        { category: "agency", value: agencyValue },
      ],
      {
        autoCreate: true,
        userId: session.user.id,
        isAdmin: profile.role === "admin",
      },
    );

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

    // 데이터 생성 로그 기록
    await logDataCreate(
      session.user.id,
      session.user.loginId,
      "캠페인",
      created.id,
      `캠페인: ${parsedInput.campaign}, 매체: ${channelValue}`,
    );

    revalidateManagementRelatedPaths();

    // 마스터 데이터가 자동 생성된 경우 관련 경로도 재검증
    if (autoCreated.length > 0) {
      revalidatePath("/masterdata");
    }

    return {
      row,
      optionValues,
      autoCreatedMasterData: autoCreated.length > 0 ? autoCreated : undefined,
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
      await assertMasterDataValues([
        { category: "creative", value: parsedInput.creative, optional: true },
      ]);
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
      await assertMasterDataValues([
        { category: "budgetAccount", value: parsedInput.budgetAccount },
      ]);
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

    // 데이터 수정 로그 기록
    const changedFields = Object.keys(data).join(", ");
    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "캠페인",
      parsedInput.id,
      `변경 항목: ${changedFields}`,
    );

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

    // 일괄 수정 로그 기록
    const changedFields: string[] = [];
    if (parsedInput.department) changedFields.push("담당부서");
    if (parsedInput.agency) changedFields.push("대행사");
    await logDataUpdate(
      session.user.id,
      session.user.loginId,
      "캠페인",
      parsedInput.ids.join(", "),
      `일괄 수정 (${parsedInput.ids.length}건): ${changedFields.join(", ")}`,
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

    // 데이터 삭제 로그 기록
    await logDataDelete(
      session.user.id,
      session.user.loginId,
      "캠페인",
      parsedInput.ids,
      `총 ${parsedInput.ids.length}건 삭제`,
    );

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

const bulkUploadSchema = z.object({
  csvContent: z
    .string()
    .min(1, "CSV 파일 내용이 비어있습니다.")
    .max(MAX_CSV_FILE_SIZE, `CSV 파일 크기는 ${MAX_CSV_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.`),
});

async function findExistingCampaign(
  parsedRow: ParsedCampaignRow,
): Promise<{ id: string } | null> {
  if (!parsedRow.startDate || !parsedRow.endDate) {
    return null;
  }

  const existing = await prisma.campaign.findFirst({
    where: {
      campaign: parsedRow.campaign,
      creative: parsedRow.creative || DEFAULT_PLACEHOLDER,
      channel: parsedRow.channel,
      startDate: new Date(parsedRow.startDate),
      endDate: new Date(parsedRow.endDate),
    },
    select: { id: true },
  });

  return existing;
}

/**
 * 모든 필드가 정확히 일치하는 중복 캠페인 찾기
 */
async function findExactDuplicateCampaign(
  parsedRow: ParsedCampaignRow,
  creativeValue: string,
  budgetAccountValue: string,
  departmentValue: string,
  agencyValue: string,
): Promise<{ id: string; campaign: Campaign } | null> {
  if (!parsedRow.startDate || !parsedRow.endDate) {
    return null;
  }

  // spend를 제외한 필드로 먼저 찾기
  const candidates = await prisma.campaign.findMany({
    where: {
      campaign: parsedRow.campaign,
      creative: creativeValue,
      channel: parsedRow.channel.trim(),
      startDate: new Date(parsedRow.startDate),
      endDate: new Date(parsedRow.endDate),
      budgetAccount: budgetAccountValue,
      department: departmentValue,
      agency: agencyValue,
    },
  });

  if (candidates.length === 0) {
    return null;
  }

  // spend 값 비교 (정확한 일치 확인)
  const parsedSpend = parsedRow.spend !== null ? new Prisma.Decimal(parsedRow.spend) : new Prisma.Decimal(0);

  for (const candidate of candidates) {
    // Prisma.Decimal 비교는 equals 메서드 사용
    if (candidate.spend.equals(parsedSpend)) {
      return { id: candidate.id, campaign: candidate };
    }
  }

  return null;
}

async function processCampaignRow(
  parsedRow: ParsedCampaignRow,
  profile: UserAccessProfile,
  columnAccess: ReturnType<typeof buildManagementColumnAccess>,
  sessionUserId: string,
): Promise<{
  row: ManagementRow;
  optionValues: ManagementOptionValues;
  skipped?: boolean;
  autoCreated?: Array<{ category: MasterDataCategory; value: string }>;
}> {
  // 필수 필드 검증
  if (!parsedRow.campaign || !parsedRow.channel || !parsedRow.department || !parsedRow.agency) {
    throw new Error(
      `행 ${parsedRow.rowNumber}: 필수 필드(캠페인, 매체/구분, 담당부서, 대행사)가 누락되었습니다.`,
    );
  }

  if (!parsedRow.startDate || !parsedRow.endDate) {
    throw new Error(`행 ${parsedRow.rowNumber}: 시작일과 종료일을 모두 입력해주세요.`);
  }

  const startDate = new Date(parsedRow.startDate);
  const endDate = new Date(parsedRow.endDate);

  if (startDate > endDate) {
    throw new Error(`행 ${parsedRow.rowNumber}: 시작일은 종료일보다 늦을 수 없습니다.`);
  }

  // 권한 검증
  ensureNewScopePermission(profile, {
    department: parsedRow.department,
    agency: parsedRow.agency,
  });

  const creativeValue = columnAccess.creative
    ? parsedRow.creative?.trim() || DEFAULT_PLACEHOLDER
    : DEFAULT_PLACEHOLDER;
  const budgetAccountValue = parsedRow.budgetAccount?.trim() || DEFAULT_BUDGET_ACCOUNT;
  const channelValue = parsedRow.channel.trim();
  const departmentValue = parsedRow.department.trim();
  const agencyValue = parsedRow.agency.trim();

  // 마스터 데이터 검증 (자동 생성 옵션 포함)
  const { autoCreated } = await assertMasterDataValues(
    [
      { category: "campaign", value: parsedRow.campaign },
      { category: "creative", value: parsedRow.creative, optional: true },
      { category: "channel", value: channelValue },
      { category: "budgetAccount", value: budgetAccountValue },
      { category: "department", value: departmentValue },
      { category: "agency", value: agencyValue },
    ],
    {
      autoCreate: true,
      userId: sessionUserId,
      isAdmin: profile.role === "admin",
    },
  );

  // 모든 필드가 정확히 일치하는 중복 캠페인 체크
  const exactDuplicate = await findExactDuplicateCampaign(
    parsedRow,
    creativeValue,
    budgetAccountValue,
    departmentValue,
    agencyValue,
  );

  if (exactDuplicate) {
    // 모든 항목이 동일하므로 중복으로 간주하고 건너뛰기
    const record = mapCampaignModelToRecord(exactDuplicate.campaign);
    ensureScopePermission(profile, record);

    const row = toManagementRow(record, columnAccess);
    const optionValues = buildOptionValues(record, columnAccess);

    return { row, optionValues, skipped: true, autoCreated };
  }

  // 기존 캠페인 찾기 (일부 필드만 일치하는 경우)
  const existing = await findExistingCampaign(parsedRow);

  let campaign;
  if (existing) {
    // 업데이트
    const spendValue = columnAccess.spend && parsedRow.spend !== null ? parsedRow.spend : undefined;

    const updateData: Prisma.CampaignUpdateInput = {
      spend: spendValue !== undefined ? new Prisma.Decimal(spendValue) : undefined,
      budgetAccount: budgetAccountValue,
      department: departmentValue,
      agency: agencyValue,
    };

    // 권한이 있는 경우에만 업데이트
    if (columnAccess.campaign) {
      updateData.campaign = parsedRow.campaign;
    }
    if (columnAccess.creative) {
      updateData.creative = creativeValue;
    }
    if (columnAccess.channel) {
      updateData.channel = channelValue;
    }
    if (columnAccess.schedule) {
      updateData.startDate = startDate;
      updateData.endDate = endDate;
    }

    campaign = await prisma.campaign.update({
      where: { id: existing.id },
      data: updateData,
    });
  } else {
    // 생성
    if (!columnAccess.campaign || !columnAccess.channel || !columnAccess.schedule) {
      throw new Error(
        `행 ${parsedRow.rowNumber}: 신규 등록을 위한 필수 컬럼 접근 권한이 없습니다.`,
      );
    }

    campaign = await prisma.campaign.create({
      data: {
        ownerId: sessionUserId,
        campaign: parsedRow.campaign,
        creative: creativeValue,
        channel: channelValue,
        startDate,
        endDate,
        spend: new Prisma.Decimal(parsedRow.spend ?? 0),
        budgetAccount: budgetAccountValue,
        department: departmentValue,
        agency: agencyValue,
      },
    });
  }

  const record = mapCampaignModelToRecord(campaign);
  ensureScopePermission(profile, record);

  const row = toManagementRow(record, columnAccess);
  const optionValues = buildOptionValues(record, columnAccess);

  return { row, optionValues, skipped: false, autoCreated };
}

export const bulkUploadCampaignsAction = actionClient
  .schema(bulkUploadSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 데이터를 업로드할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
    const columnAccess = buildManagementColumnAccess(profile);

    // CSV 파싱
    const rows = parseCsvFile(parsedInput.csvContent);

    if (rows.length === 0) {
      throw new Error("CSV 파일이 비어있거나 올바른 형식이 아닙니다.");
    }

    // 헤더 검증
    const headers = createTemplateHeaders();
    const headerRow = rows[0];

    if (headerRow.length !== headers.length) {
      throw new Error(
        `헤더 컬럼 수가 일치하지 않습니다. 예상: ${headers.length}개, 실제: ${headerRow.length}개`,
      );
    }

    // 데이터 행 처리
    const dataRows = rows.slice(1);
    if (dataRows.length === 0) {
      throw new Error("업로드할 데이터가 없습니다.");
    }

    const results: {
      row: ManagementRow;
      optionValues: ManagementOptionValues;
      skipped?: boolean;
      autoCreated?: Array<{ category: MasterDataCategory; value: string }>;
    }[] = [];
    const errors: string[] = [];
    let skippedCount = 0;
    const allAutoCreated = new Map<string, { category: MasterDataCategory; value: string }>();

    for (const row of dataRows) {
      const rowIndex = rows.indexOf(row) + 1;
      try {
        const parsedRow = parseCampaignRow(row, rowIndex, headers);

        if (!parsedRow) {
          errors.push(`행 ${rowIndex}: 데이터 형식이 올바르지 않습니다. (컬럼 수: ${row.length}, 예상: ${headers.length})`);
          continue;
        }

        const result = await processCampaignRow(
          parsedRow,
          profile,
          columnAccess,
          session.user.id,
        );

        if (result.skipped) {
          skippedCount++;
        }

        // 자동 생성된 마스터 데이터 수집
        if (result.autoCreated) {
          for (const item of result.autoCreated) {
            const key = `${item.category}:${item.value}`;
            if (!allAutoCreated.has(key)) {
              allAutoCreated.set(key, item);
            }
          }
        }

        results.push(result);
      } catch (error) {
        const message = error instanceof Error 
          ? `행 ${rowIndex}: ${error.message}` 
          : `행 ${rowIndex}: 알 수 없는 오류가 발생했습니다.`;
        errors.push(message);
        // 프로덕션 환경에서는 구조화된 로깅 사용 고려
        if (process.env.NODE_ENV === "development") {
          console.error(`CSV 업로드 오류 (행 ${rowIndex}):`, error);
        }
      }
    }

    const successCount = results.length - skippedCount;

    if (successCount === 0 && skippedCount === 0) {
      const errorDetails = errors.length > 0 
        ? `\n\n오류 상세:\n${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
        : "";
      throw new Error(
        `모든 행 처리에 실패했습니다.${errorDetails}`,
      );
    }

    if (errors.length > 0) {
      // 일부 성공한 경우에도 경고 메시지 포함
      console.warn("일부 행 처리 실패:", errors);
    }

    revalidateManagementRelatedPaths();

    // 마스터 데이터가 자동 생성된 경우 관련 경로도 재검증
    if (allAutoCreated.size > 0) {
      revalidatePath("/masterdata");
    }

    // 엑셀 업로드 로그 기록
    const autoCreatedDetails =
      allAutoCreated.size > 0
        ? ` (자동 생성된 마스터 데이터: ${allAutoCreated.size}건)`
        : "";
    await logExcelUpload(
      session.user.id,
      session.user.loginId,
      successCount,
      errors.length,
      skippedCount,
      autoCreatedDetails,
    );

    return {
      rows: results.map((r) => r.row),
      optionValues: results.map((r) => r.optionValues),
      successCount,
      skippedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      autoCreatedMasterData: Array.from(allAutoCreated.values()),
    };
  });

export type CreateCampaignResult = {
  row: ManagementRow;
  optionValues: ManagementOptionValues;
  autoCreatedMasterData?: Array<{ category: MasterDataCategory; value: string }>;
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

export type BulkUploadCampaignResult = {
  rows: ManagementRow[];
  optionValues: ManagementOptionValues[];
  successCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
};
