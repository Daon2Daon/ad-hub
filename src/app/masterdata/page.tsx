import { redirect } from "next/navigation";

import { MasterDataPageClient } from "@/components/master-data/MasterDataPageClient";
import { requireActiveSession } from "@/lib/auth/session";
import { fetchMasterDataItems } from "@/lib/master-data/repository";
import { MASTER_DATA_CATEGORY_META, MASTER_DATA_CATEGORIES } from "@/types/master-data";

const Page = async () => {
  const session = await requireActiveSession();
  const profile = session.accessProfile;

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const items = await fetchMasterDataItems();

  const categories = MASTER_DATA_CATEGORIES.map((key) => MASTER_DATA_CATEGORY_META[key]);

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-100 px-6 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">마스터 데이터 관리</h1>
        <p className="text-sm text-slate-600">
          캠페인 등록 시 선택할 수 있는 기초 데이터를 사전에 등록하고 관리합니다. 변경 사항은 매체
          스케줄 및 광고집행 관리 화면에도 즉시 반영됩니다.
        </p>
      </header>

      <MasterDataPageClient categories={categories} initialItems={items} />
    </main>
  );
};

export default Page;
