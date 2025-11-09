import { addDays, subMonths } from "date-fns";

import type { CampaignRecord } from "@/types/dashboard";

const today = new Date();

function buildRecord(partial: Partial<CampaignRecord> & Pick<CampaignRecord, "id">): CampaignRecord {
  const defaultStart = subMonths(today, 2);
  const defaultEnd = addDays(today, 30);

  return {
    id: partial.id,
    campaign: partial.campaign ?? "미정 캠페인",
    creative: partial.creative ?? "미정 소재",
    channel: partial.channel ?? "디스플레이",
    startDate: partial.startDate ?? defaultStart.toISOString(),
    endDate: partial.endDate ?? defaultEnd.toISOString(),
    spend: partial.spend ?? 0,
    budgetAccount: partial.budgetAccount ?? "DEFAULT",
    department: partial.department ?? "A부서",
    agency: partial.agency ?? "A대행사",
  };
}

export const DASHBOARD_SAMPLE_DATA: CampaignRecord[] = [
  buildRecord({
    id: "cmp-1",
    campaign: "봄 시즌 프로모션",
    creative: "배너A",
    channel: "디스플레이",
    spend: 1200000,
    budgetAccount: "BA-1001",
    department: "A부서",
    agency: "A대행사",
  }),
  buildRecord({
    id: "cmp-2",
    campaign: "여름 한정 이벤트",
    creative: "배너B",
    channel: "SNS",
    spend: 800000,
    budgetAccount: "BA-1002",
    department: "B부서",
    agency: "B대행사",
  }),
  buildRecord({
    id: "cmp-3",
    campaign: "리마인드 캠페인",
    creative: "동영상A",
    channel: "동영상",
    spend: 450000,
    budgetAccount: "BA-1001",
    department: "A부서",
    agency: "A대행사",
  }),
  buildRecord({
    id: "cmp-4",
    campaign: "신제품 런칭",
    creative: "배너C",
    channel: "디스플레이",
    spend: 1500000,
    budgetAccount: "BA-1003",
    department: "C부서",
    agency: "A대행사",
  }),
  buildRecord({
    id: "cmp-5",
    campaign: "브랜드 캠페인",
    creative: "배너A",
    channel: "검색",
    spend: 600000,
    budgetAccount: "BA-1004",
    department: "A부서",
    agency: "C대행사",
  }),
];

