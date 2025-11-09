import { redirect } from "next/navigation";

import { SchedulePageClient } from "@/components/schedule/SchedulePageClient";
import { filterRowsByScope } from "@/lib/auth/permissions";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";
import { buildScheduleColumnAccess, buildScheduleOptions, toScheduleRecord } from "@/lib/schedule/utils";
import type { ScheduleOptions, ScheduleRecord } from "@/types/schedule";

const Page = async () => {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.status !== "active") {
    redirect("/login?status=pending");
  }

  const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
  const campaigns = await fetchCampaignRecords();
  const scopedCampaigns = filterRowsByScope(campaigns, profile);

  const columnAccess = buildScheduleColumnAccess(profile);
  const options: ScheduleOptions = buildScheduleOptions(scopedCampaigns, columnAccess);

  const scheduleRecords: ScheduleRecord[] = scopedCampaigns.map((campaign) =>
    toScheduleRecord(campaign, columnAccess),
  );

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">매체 스케줄</h1>
        <p className="text-sm text-slate-600">
          간트 차트와 캘린더 뷰를 통해 캠페인 일정을 확인하고 신규 일정을 등록할 수 있습니다.
        </p>
      </header>

      <SchedulePageClient records={scheduleRecords} columnAccess={columnAccess} options={options} />
    </main>
  );
};

export default Page;

