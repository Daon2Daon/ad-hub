import { endOfMonth, endOfYear, isWithinInterval, startOfMonth, startOfYear } from "date-fns";

import { filterRowsByScope, hasColumnAccess } from "@/lib/auth/permissions";
import type { UserAccessProfile } from "@/types/auth";
import type {
  CampaignRecord,
  DashboardData,
  DateRange,
  DistributionSlice,
  KpiSummary,
} from "@/types/dashboard";

export interface DashboardOptions {
  baseDate?: Date;
  customRange?: DateRange;
}

export function getDefaultRanges(baseDate: Date = new Date()): { month: DateRange; year: DateRange } {
  return {
    month: {
      start: startOfMonth(baseDate),
      end: endOfMonth(baseDate),
    },
    year: {
      start: startOfYear(baseDate),
      end: endOfYear(baseDate),
    },
  };
}

function overlaps(range: DateRange, start: Date, end: Date) {
  return (
    isWithinInterval(start, range) ||
    isWithinInterval(end, range) ||
    (start <= range.start && end >= range.end)
  );
}

export function calculateKpis(
  periodRecords: CampaignRecord[],
  {
    yearRecords,
    profile,
  }: { yearRecords: CampaignRecord[]; profile: UserAccessProfile },
): KpiSummary {
  const activeCampaigns = periodRecords.length;

  const spendAllowed = hasColumnAccess(profile, "spend");

  const periodSpend = spendAllowed
    ? periodRecords.reduce((acc, record) => acc + record.spend, 0)
    : null;

  const yearlySpend = spendAllowed
    ? yearRecords.reduce((acc, record) => acc + record.spend, 0)
    : null;

  return {
    activeCampaigns,
    periodSpend,
    yearlySpend,
  };
}

function buildDistribution(records: CampaignRecord[], key: "creative" | "agency"): DistributionSlice[] {
  const map = new Map<string, number>();

  records.forEach((record) => {
    map.set(record[key], (map.get(record[key]) ?? 0) + record.spend);
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function generateDashboardData(
  allRecords: CampaignRecord[],
  profile: UserAccessProfile,
  options: DashboardOptions = {},
): DashboardData {
  const baseDate = options.baseDate ?? new Date();
  const defaults = getDefaultRanges(baseDate);
  const range = options.customRange ?? defaults.month;

  const scoped = filterRowsByScope(allRecords, profile);
  const normalized = scoped.map((record) => ({
    record,
    start: new Date(record.startDate),
    end: new Date(record.endDate),
  }));

  const periodRecords = normalized
    .filter(({ start, end }) => overlaps(range, start, end))
    .map(({ record }) => record);

  const yearlyScopedRecords = normalized
    .filter(({ start, end }) => overlaps(defaults.year, start, end))
    .map(({ record }) => record);

  const kpis = calculateKpis(periodRecords, {
    yearRecords: yearlyScopedRecords,
    profile,
  });

  const spendAllowed = hasColumnAccess(profile, "spend");

  const byCreative = spendAllowed ? buildDistribution(periodRecords, "creative") : [];
  const byAgency = spendAllowed ? buildDistribution(periodRecords, "agency") : [];

  return {
    range,
    kpis,
    byCreative,
    byAgency,
  };
}

