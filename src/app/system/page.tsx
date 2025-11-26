import { redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/session";
import { fetchMasterDataItems } from "@/lib/master-data/repository";
import { SystemPageClient } from "@/components/system/SystemPageClient";
import { getUserList } from "@/lib/system/actions";

const Page = async () => {
  const session = await requireActiveSession({ pendingRedirectTo: "/dashboard" });

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  // 사용자 목록 조회
  const pendingUsers = await getUserList("pending");
  const activeUsers = await getUserList("active");

  // 마스터 데이터 조회 (담당부서, 대행사)
  const masterData = await fetchMasterDataItems();

  return (
    <SystemPageClient
      pendingUsers={pendingUsers}
      activeUsers={activeUsers}
      departments={masterData.department}
      agencies={masterData.agency}
    />
  );
};

export default Page;

