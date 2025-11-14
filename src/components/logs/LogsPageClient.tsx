"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ActivityLogType } from "@prisma/client";

import { cn } from "@/lib/utils";
import type { ActivityLogsResult } from "@/types/logs";
import { ACTIVITY_LOG_TYPE_LABELS } from "@/types/logs";

interface LogsPageClientProps {
  initialData: ActivityLogsResult;
}

const ACTIVITY_LOG_TYPES: ActivityLogType[] = [
  "login_success",
  "login_failure",
  "data_create",
  "data_update",
  "data_delete",
  "excel_upload",
];

export const LogsPageClient = ({ initialData }: LogsPageClientProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = initialData;

  const currentType = searchParams.get("type") as ActivityLogType | null;
  const currentLoginId = searchParams.get("loginId") || "";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";

  // data 객체의 page 속성 접근 시 인덱스 시그니처 문제 해결
  const page = data["page"] ?? 1;
  const totalPages = data["totalPages"] ?? 1;
  const total = data["total"] ?? 0;
  const pageSize = data["pageSize"] ?? 20;

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // 페이지가 변경되면 1페이지로 리셋
    if (updates["page"] === undefined && Object.keys(updates).some(k => k !== "page")) {
      params.set("page", "1");
    }

    router.push(`/logs?${params.toString()}`);
  };

  const handleTypeChange = (type: ActivityLogType | null) => {
    updateSearchParams({ type: type || null });
  };

  const handleLoginIdChange = (loginId: string) => {
    updateSearchParams({ loginId: loginId || null });
  };

  const handleStartDateChange = (date: string) => {
    updateSearchParams({ startDate: date || null });
  };

  const handleEndDateChange = (date: string) => {
    updateSearchParams({ endDate: date || null });
  };

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(date));
  };

  const getTypeBadgeColor = (type: ActivityLogType) => {
    const colors: Record<ActivityLogType, string> = {
      login_success: "bg-green-100 text-green-800",
      login_failure: "bg-red-100 text-red-800",
      data_create: "bg-blue-100 text-blue-800",
      data_update: "bg-yellow-100 text-yellow-800",
      data_delete: "bg-orange-100 text-orange-800",
      excel_upload: "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-slate-100 text-slate-800";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 필터 섹션 */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">필터</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-700">작업 유형</label>
            <select
              value={currentType || ""}
              onChange={(e) => handleTypeChange((e.target.value || null) as ActivityLogType | null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">전체</option>
              {ACTIVITY_LOG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_LOG_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-700">사용자 아이디</label>
            <input
              type="text"
              value={currentLoginId}
              onChange={(e) => handleLoginIdChange(e.target.value)}
              placeholder="검색할 아이디 입력"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-700">시작일</label>
            <input
              type="date"
              value={currentStartDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-700">종료일</label>
            <input
              type="date"
              value={currentEndDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>
      </section>

      {/* 로그 테이블 */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">시간</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">작업 유형</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">사용자</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">상세 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    조회된 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          getTypeBadgeColor(log.type),
                        )}
                      >
                        {ACTIVITY_LOG_TYPE_LABELS[log.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {log.user?.name || log.loginId || "알 수 없음"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                총 {total.toLocaleString("ko-KR")}건 중{" "}
                {((page - 1) * pageSize + 1).toLocaleString("ko-KR")}-
                {Math.min(page * pageSize, total).toLocaleString("ko-KR")}건 표시
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className={cn(
                    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition",
                    page === 1
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  처음
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className={cn(
                    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition",
                    page === 1
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  이전
                </button>
                <span className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className={cn(
                    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition",
                    page >= totalPages
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  다음
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page >= totalPages}
                  className={cn(
                    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition",
                    page >= totalPages
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  마지막
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

