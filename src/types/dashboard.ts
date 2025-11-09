import type { ScopedEntity } from "@/types/auth";

export interface CampaignRecord extends ScopedEntity {
  id: string;
  campaign: string;
  creative: string;
  channel: string;
  startDate: string;
  endDate: string;
  spend: number;
  budgetAccount: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface KpiSummary {
  activeCampaigns: number;
  periodSpend: number | null;
  yearlySpend: number | null;
}

export interface DistributionSlice {
  label: string;
  value: number;
}

export interface DashboardData {
  range: DateRange;
  kpis: KpiSummary;
  byCreative: DistributionSlice[];
  byAgency: DistributionSlice[];
}

