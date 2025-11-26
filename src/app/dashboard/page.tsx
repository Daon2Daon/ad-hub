import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { requireActiveSession } from "@/lib/auth/session";
import { generateDashboardData } from "@/lib/dashboard/metrics";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";

const Page = async () => {
  const session = await requireActiveSession();
  const profile = session.accessProfile;
  const records = await fetchCampaignRecords(profile);

  const dashboard = generateDashboardData(records, profile);

  const currencyFormatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  });

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-100 px-4 py-6 md:gap-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-3 md:gap-4">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">대시보드</h1>
      </header>

      {records.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          등록된 캠페인 데이터가 없습니다. 데이터를 업로드하거나 시드 스크립트를 실행해 초기
          데이터를 생성하세요.
        </section>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <KpiCard
              title="현재 집행중인 광고 (건)"
              value={`${dashboard.kpis.activeCampaigns.toLocaleString("ko-KR")} 건`}
            />
            <KpiCard
              title="이번 달 광고비 (원)"
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
            <DistributionCard title="이번 달 소재별 광고 비중" slices={dashboard.byCreative} />
            <DistributionCard title="이번 달 대행사별 광고 비중" slices={dashboard.byAgency} />
          </section>
        </>
      )}
    </main>
  );
};

export default Page;
