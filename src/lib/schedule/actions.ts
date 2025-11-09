"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { buildScheduleColumnAccess, mapCampaignModelToRecord, toScheduleRecord } from "@/lib/schedule/utils";
import { actionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import type { ScheduleOptionValues } from "@/types/schedule";

const createScheduleSchema = z
  .object({
    campaign: z.string().trim().min(1, "캠페인을 입력해주세요.").max(120),
    creative: z.string().trim().max(120).optional(),
    channel: z.string().trim().min(1, "매체를 입력해주세요.").max(80),
    department: z.string().trim().max(80).optional(),
    agency: z.string().trim().max(80).optional(),
    startDate: z.coerce.date({ message: "시작일을 선택해주세요." }),
    endDate: z.coerce.date({ message: "종료일을 선택해주세요." }),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "시작일은 종료일보다 늦을 수 없습니다.",
    path: ["endDate"],
  });

const DEFAULT_BUDGET_ACCOUNT = "UNASSIGNED";
const DEFAULT_PLACEHOLDER = "미정";

export const createScheduleAction = actionClient
  .schema(createScheduleSchema)
  .action(async ({ parsedInput }) => {
    const session = await getServerAuthSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    if (session.user.status !== "active") {
      throw new Error("승인된 사용자만 일정을 등록할 수 있습니다.");
    }

    const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
    const columnAccess = buildScheduleColumnAccess(profile);

    if (!columnAccess.schedule) {
      throw new Error("일정 등록 권한이 없습니다.");
    }

    if (!columnAccess.campaign) {
      throw new Error("캠페인 컬럼 접근 권한이 없어 일정을 등록할 수 없습니다.");
    }

    if (!columnAccess.channel) {
      throw new Error("매체 컬럼 접근 권한이 없어 일정을 등록할 수 없습니다.");
    }

    if (!columnAccess.department) {
      throw new Error("담당부서 컬럼 접근 권한이 없어 일정을 등록할 수 없습니다.");
    }

    if (!columnAccess.agency) {
      throw new Error("대행사 컬럼 접근 권한이 없어 일정을 등록할 수 없습니다.");
    }

    const campaignValue = parsedInput.campaign;
    const creativeValue = columnAccess.creative ? parsedInput.creative?.trim() || DEFAULT_PLACEHOLDER : DEFAULT_PLACEHOLDER;
    const channelValue = parsedInput.channel;
    const departmentValue = parsedInput.department?.trim() || DEFAULT_PLACEHOLDER;
    const agencyValue = parsedInput.agency?.trim() || DEFAULT_PLACEHOLDER;

    if (profile.role !== "admin") {
      if (
        profile.scope.departments.length > 0 &&
        !profile.scope.departments.includes(departmentValue)
      ) {
        throw new Error("허용되지 않은 담당부서입니다.");
      }

      if (profile.scope.agencies.length > 0 && !profile.scope.agencies.includes(agencyValue)) {
        throw new Error("허용되지 않은 대행사입니다.");
      }
    }

    const created = await prisma.campaign.create({
      data: {
        ownerId: session.user.id,
        campaign: campaignValue,
        creative: creativeValue,
        channel: channelValue,
        startDate: parsedInput.startDate,
        endDate: parsedInput.endDate,
        spend: new Prisma.Decimal(0),
        budgetAccount: DEFAULT_BUDGET_ACCOUNT,
        department: departmentValue,
        agency: agencyValue,
      },
    });

    const record = toScheduleRecord(mapCampaignModelToRecord(created), columnAccess);

    const optionValues: ScheduleOptionValues = {
      campaign: columnAccess.campaign ? campaignValue : null,
      creative: columnAccess.creative ? creativeValue : null,
      channel: channelValue,
      department: departmentValue,
      agency: agencyValue,
    };

    revalidatePath("/schedule");

    return {
      record,
      optionValues,
    };
  });


