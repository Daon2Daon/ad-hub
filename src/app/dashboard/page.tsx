import { redirect } from "next/navigation";

import { DateRangeSummary } from "@/components/dashboard/DateRangeSummary";
import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { generateDashboardData } from "@/lib/dashboard/metrics";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";

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

  const dashboard = generateDashboardData(records, profile);

  const currencyFormatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  });

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">대시보드</h1>
        <p className="text-sm text-slate-600">
          기본 기간(이번 달) 데이터를 표기합니다. 추후 커스텀 기간 선택 기능을 추가합니다.
        </p>
        <DateRangeSummary label="기본 기간" range={dashboard.range} />
      </header>

      {records.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          등록된 캠페인 데이터가 없습니다. 데이터를 업로드하거나 시드 스크립트를 실행해 초기 데이터를
          생성하세요.
        </section>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <KpiCard
              title="집행중인 광고 (건)"
              value={`${dashboard.kpis.activeCampaigns.toLocaleString("ko-KR")} 건`}
            />
            <KpiCard
              title="선택 기간 광고비 (원)"
              value={
                dashboard.kpis.periodSpend !== null
                  ? currencyFormatter.format(dashboard.kpis.periodSpend)
                  : "권한 없음"
              }
            />
            <KpiCard
              title="올해 누적 광고비 (원)"
              value={
                dashboard.kpis.yearlySpend !== null
                  ? currencyFormatter.format(dashboard.kpis.yearlySpend)
                  : "권한 없음"
              }
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <DistributionCard title="선택 기간 소재별 광고 비중" slices={dashboard.byCreative} />
            <DistributionCard title="선택 기간 대행사별 광고 비중" slices={dashboard.byAgency} />
          </section>
        </>
      )}
    </main>
  );
};

export default Page;

