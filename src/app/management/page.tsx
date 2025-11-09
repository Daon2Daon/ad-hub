import { redirect } from "next/navigation";

import { ManagementPageClient } from "@/components/management/ManagementPageClient";
import { filterRowsByScope } from "@/lib/auth/permissions";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";
import {
  buildManagementColumnAccess,
  buildManagementOptions,
  toManagementRow,
} from "@/lib/management/utils";

const Page = async () => {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.status !== "active") {
    redirect("/login?status=pending");
  }

  const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
  const columnAccess = buildManagementColumnAccess(profile);

  const campaigns = await fetchCampaignRecords();
  const scopedRecords = filterRowsByScope(campaigns, profile);

  const rows = scopedRecords.map((record) => toManagementRow(record, columnAccess));
  const options = buildManagementOptions(scopedRecords, columnAccess);

  const totalSpend = columnAccess.spend
    ? scopedRecords.reduce((acc, record) => acc + record.spend, 0)
    : null;

  const hasVisibleColumns = Object.values(columnAccess).some((value) => value);

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">광고집행 관리</h1>
        <p className="text-sm text-slate-600">
          캠페인 데이터를 조회하고 신규 등록, 수정, 삭제, 일괄 작업을 수행할 수 있습니다. 컬럼과 데이터는
          사용자 권한에 따라 제한될 수 있습니다.
        </p>
      </header>

      {!hasVisibleColumns ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          열람 가능한 컬럼 권한이 없습니다. 관리자에게 컬럼 접근 권한을 요청해주세요.
        </section>
      ) : (
        <ManagementPageClient
          rows={rows}
          columnAccess={columnAccess}
          options={options}
          totalSpend={totalSpend}
        />
      )}
    </main>
  );
};

export default Page;
