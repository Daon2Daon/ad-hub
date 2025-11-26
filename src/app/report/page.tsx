import { ReportPageClient } from "@/components/report/ReportPageClient";
import { requireActiveSession } from "@/lib/auth/session";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";
import {
  buildReportColumnAccess,
  buildReportOptions,
  buildReportSummary,
  toReportRow,
} from "@/lib/report/utils";

const Page = async () => {
  const session = await requireActiveSession();
  const profile = session.accessProfile;
  const records = await fetchCampaignRecords(profile);
  const columnAccess = buildReportColumnAccess(profile);

  const rows = records.map((record) => toReportRow(record, columnAccess));
  const options = buildReportOptions(records, columnAccess);
  const summary = buildReportSummary(records, columnAccess);

  const hasVisibleColumns = Object.values(columnAccess).some(Boolean);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-100 px-4 py-6 md:gap-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-3 md:gap-4">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">리포트</h1>
        <p className="text-xs text-slate-600 md:text-sm">
          기간, 캠페인, 매체/구분 등 다양한 조건으로 데이터를 필터링하고 결과를 CSV로 내려받을 수
          있습니다. 컬럼과 데이터는 사용자 권한에 따라 제한될 수 있습니다.
        </p>
      </header>

      {!hasVisibleColumns ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          열람 가능한 컬럼 권한이 없어 리포트 데이터를 확인할 수 없습니다. 관리자에게 컬럼 접근
          권한을 요청해주세요.
        </section>
      ) : records.length === 0 ? (
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
