import { redirect } from "next/navigation";
import type { ActivityLogType } from "@prisma/client";

import { LogsPageClient } from "@/components/logs/LogsPageClient";
import { requireActiveSession } from "@/lib/auth/session";
import { fetchActivityLogs } from "@/lib/logs/repository";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    loginId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const session = await requireActiveSession();
  const profile = session.accessProfile;

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  
  // ActivityLogType 유효성 검증
  const validTypes: ActivityLogType[] = [
    "login_success",
    "login_failure",
    "data_create",
    "data_update",
    "data_delete",
    "excel_upload",
  ];
  const type = params.type && validTypes.includes(params.type as ActivityLogType)
    ? (params.type as ActivityLogType)
    : undefined;

  const filters = {
    type,
    loginId: params.loginId,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
  };

  const result = await fetchActivityLogs({
    page,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">활동 로그</h1>
        <p className="text-sm text-slate-600">
          시스템의 주요 변경 이력을 시간순으로 조회할 수 있습니다. 로그인, 데이터 생성/수정/삭제,
          엑셀 업로드 등의 활동이 기록됩니다.
        </p>
      </header>

      <LogsPageClient initialData={result} />
    </main>
  );
};

export default Page;

