import { SchedulePageClient } from "@/components/schedule/SchedulePageClient";
import { requireActiveSession } from "@/lib/auth/session";
import { fetchCampaignRecords } from "@/lib/dashboard/repository";
import {
  buildManagementColumnAccess,
  buildManagementOptionsFromMasterData,
} from "@/lib/management/utils";
import { fetchMasterDataItems } from "@/lib/master-data/repository";
import {
  buildScheduleColumnAccess,
  buildScheduleOptionsFromMasterData,
  toScheduleRecord,
} from "@/lib/schedule/utils";
import type { ScheduleRecord } from "@/types/schedule";
import type { ManagementColumnAccess, ManagementOptions } from "@/types/management";

const Page = async () => {
  const session = await requireActiveSession();
  const profile = session.accessProfile;
  const [campaigns, masterData] = await Promise.all([
    fetchCampaignRecords(profile),
    fetchMasterDataItems(),
  ]);

  const columnAccess = buildScheduleColumnAccess(profile);
  const options = buildScheduleOptionsFromMasterData(masterData, columnAccess);
  const formColumnAccess: ManagementColumnAccess = buildManagementColumnAccess(profile);
  const formOptions: ManagementOptions = buildManagementOptionsFromMasterData(
    masterData,
    formColumnAccess,
  );

  const scheduleRecords: ScheduleRecord[] = campaigns.map((campaign) =>
    toScheduleRecord(campaign, columnAccess),
  );

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-100 px-4 py-6 md:gap-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-3 md:gap-4">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">매체 스케줄</h1>
        <p className="text-xs text-slate-600 md:text-sm">
          간트 차트와 캘린더 뷰를 통해 캠페인 일정을 확인하고 신규 일정을 등록할 수 있습니다.
        </p>
      </header>

      <SchedulePageClient
        records={scheduleRecords}
        columnAccess={columnAccess}
        options={options}
        formColumnAccess={formColumnAccess}
        formOptions={formOptions}
      />
    </main>
  );
};

export default Page;
