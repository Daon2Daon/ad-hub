import { redirect } from "next/navigation";

import { ReportPageClient } from "@/components/report/ReportPageClient";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { filterRowsByScope } from "@/lib/auth/permissions";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";
import {
  buildReportColumnAccess,
  buildReportOptions,
  buildReportSummary,
  toReportRow,
} from "@/lib/report/utils";

const Page = async () => {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.status !== "active") {
    redirect("/login?status=pending");
  }

  const records = await fetchCampaignRecords();
  const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
  const columnAccess = buildReportColumnAccess(profile);

  const scopedRecords = filterRowsByScope(records, profile);

  const rows = scopedRecords.map((record) => toReportRow(record, columnAccess));
  const options = buildReportOptions(scopedRecords, columnAccess);
  const summary = buildReportSummary(scopedRecords, columnAccess);

  const hasVisibleColumns = Object.values(columnAccess).some(Boolean);

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">리포트</h1>
        <p className="text-sm text-slate-600">
          기간, 캠페인, 매체/구분 등 다양한 조건으로 데이터를 필터링하고 결과를 CSV로 내려받을 수
          있습니다. 컬럼과 데이터는 사용자 권한에 따라 제한될 수 있습니다.
        </p>
      </header>

      {!hasVisibleColumns ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          열람 가능한 컬럼 권한이 없어 리포트 데이터를 확인할 수 없습니다. 관리자에게 컬럼 접근
          권한을 요청해주세요.
        </section>
      ) : scopedRecords.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          표시할 데이터가 없습니다. 캠페인 데이터를 등록하거나 승인된 데이터 범위를 확인하세요.
        </section>
      ) : (
        <ReportPageClient
          rows={rows}
          columnAccess={columnAccess}
          options={options}
          summary={summary}
        />
      )}
    </main>
  );
};

export default Page;
