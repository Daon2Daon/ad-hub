import type { ActivityLogType } from "@prisma/client";

export interface ActivityLogFilters {
  type?: ActivityLogType;
  loginId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ActivityLogQueryParams {
  page?: number;
  pageSize?: number;
  filters?: ActivityLogFilters;
}

export interface ActivityLogWithUser {
  id: string;
  userId: string | null;
  loginId: string | null;
  type: ActivityLogType;
  details: string;
  createdAt: Date;
  user: {
    name: string | null;
    loginId: string;
  } | null;
}

export interface ActivityLogsResult {
  logs: ActivityLogWithUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ACTIVITY_LOG_TYPE_LABELS: Record<ActivityLogType, string> = {
  login_success: "로그인 성공",
  login_failure: "로그인 실패",
  data_create: "데이터 생성",
  data_update: "데이터 수정",
  data_delete: "데이터 삭제",
  excel_upload: "엑셀 업로드",
};

