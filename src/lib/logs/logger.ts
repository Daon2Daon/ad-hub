"use server";

import type { ActivityLogType } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface LogActivityParams {
  userId?: string;
  loginId?: string;
  type: ActivityLogType;
  details: string;
}

/**
 * 활동 로그를 기록합니다.
 * 비동기적으로 실행되며 에러가 발생해도 메인 로직에 영향을 주지 않습니다.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        loginId: params.loginId ?? null,
        type: params.type,
        details: params.details,
      },
    });
  } catch (error) {
    // 로그 기록 실패는 메인 로직에 영향을 주지 않도록 에러를 무시합니다.
    // 프로덕션 환경에서는 별도의 로깅 서비스로 에러를 전송하는 것을 고려하세요.
    logger.error(
      "활동 로그 기록 실패",
      error instanceof Error ? error : new Error(String(error)),
      { params },
    );
  }
}

/**
 * 로그인 성공 로그를 기록합니다.
 */
export async function logLoginSuccess(userId: string, loginId: string): Promise<void> {
  await logActivity({
    userId,
    loginId,
    type: "login_success",
    details: `로그인 성공`,
  });
}

/**
 * 로그인 실패 로그를 기록합니다.
 */
export async function logLoginFailure(loginId: string, reason?: string): Promise<void> {
  await logActivity({
    loginId,
    type: "login_failure",
    details: `로그인 실패${reason ? `: ${reason}` : ""}`,
  });
}

/**
 * 데이터 생성 로그를 기록합니다.
 */
export async function logDataCreate(
  userId: string,
  loginId: string,
  resourceType: string,
  resourceId: string,
  details?: string,
): Promise<void> {
  await logActivity({
    userId,
    loginId,
    type: "data_create",
    details: `${resourceType} 생성 (ID: ${resourceId})${details ? ` - ${details}` : ""}`,
  });
}

/**
 * 데이터 수정 로그를 기록합니다.
 */
export async function logDataUpdate(
  userId: string,
  loginId: string,
  resourceType: string,
  resourceId: string,
  details?: string,
): Promise<void> {
  await logActivity({
    userId,
    loginId,
    type: "data_update",
    details: `${resourceType} 수정 (ID: ${resourceId})${details ? ` - ${details}` : ""}`,
  });
}

/**
 * 데이터 삭제 로그를 기록합니다.
 */
export async function logDataDelete(
  userId: string,
  loginId: string,
  resourceType: string,
  resourceIds: string[],
  details?: string,
): Promise<void> {
  const count = resourceIds.length;
  const idsText = count === 1 ? resourceIds[0] : `${count}건`;
  await logActivity({
    userId,
    loginId,
    type: "data_delete",
    details: `${resourceType} 삭제 (${idsText})${details ? ` - ${details}` : ""}`,
  });
}

/**
 * 엑셀 업로드 로그를 기록합니다.
 */
export async function logExcelUpload(
  userId: string,
  loginId: string,
  successCount: number,
  errorCount: number,
  skippedCount: number,
  details?: string,
): Promise<void> {
  await logActivity({
    userId,
    loginId,
    type: "excel_upload",
    details: `엑셀 업로드 완료 (성공: ${successCount}건, 실패: ${errorCount}건, 건너뜀: ${skippedCount}건)${details ? ` - ${details}` : ""}`,
  });
}

