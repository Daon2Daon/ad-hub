"use server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ActivityLogQueryParams,
  ActivityLogsResult,
} from "@/types/logs";

const DEFAULT_PAGE_SIZE = 20;

/**
 * 활동 로그를 조회합니다.
 */
export async function fetchActivityLogs(
  params: ActivityLogQueryParams = {},
): Promise<ActivityLogsResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const filters = params.filters ?? {};

  const where: Prisma.ActivityLogWhereInput = {};

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.loginId) {
    where.loginId = {
      contains: filters.loginId,
      mode: "insensitive",
    };
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      // 종료일은 하루 끝까지 포함
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            loginId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
  };
}

