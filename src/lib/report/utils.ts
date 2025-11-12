import { hasColumnAccess } from "@/lib/auth/permissions";
import type { UserAccessProfile } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";
import type { ReportColumnAccess, ReportOptions, ReportRow, ReportSummary } from "@/types/report";

const EMPTY_LABEL = "권한 없음";

export function buildReportColumnAccess(profile: UserAccessProfile): ReportColumnAccess {
  return {
    campaign: hasColumnAccess(profile, "campaign"),
    creative: hasColumnAccess(profile, "creative"),
    channel: hasColumnAccess(profile, "channel"),
    schedule: hasColumnAccess(profile, "schedule"),
    spend: hasColumnAccess(profile, "spend"),
    budgetAccount: hasColumnAccess(profile, "budgetAccount"),
    department: hasColumnAccess(profile, "department"),
    agency: hasColumnAccess(profile, "agency"),
  };
}

export function toReportRow(record: CampaignRecord, access: ReportColumnAccess): ReportRow {
  return {
    id: record.id,
    campaign: access.campaign ? record.campaign : EMPTY_LABEL,
    creative: access.creative ? record.creative : EMPTY_LABEL,
    channel: access.channel ? record.channel : EMPTY_LABEL,
    startDate: access.schedule ? record.startDate : null,
    endDate: access.schedule ? record.endDate : null,
    spend: access.spend ? record.spend : null,
    budgetAccount: access.budgetAccount ? record.budgetAccount : EMPTY_LABEL,
    department: access.department ? record.department : EMPTY_LABEL,
    agency: access.agency ? record.agency : EMPTY_LABEL,
  };
}

export function buildReportOptions(
  records: CampaignRecord[],
  access: ReportColumnAccess,
): ReportOptions {
  const unique = (values: string[]) =>
    Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ko"));

  return {
    campaigns: access.campaign ? unique(records.map((record) => record.campaign)) : [],
    creatives: access.creative ? unique(records.map((record) => record.creative)) : [],
    channels: access.channel ? unique(records.map((record) => record.channel)) : [],
    departments: access.department ? unique(records.map((record) => record.department)) : [],
    agencies: access.agency ? unique(records.map((record) => record.agency)) : [],
    budgetAccounts: access.budgetAccount ? unique(records.map((record) => record.budgetAccount)) : [],
  };
}

export function buildReportSummary(
  records: CampaignRecord[],
  access: ReportColumnAccess,
): ReportSummary {
  const totalSpend = access.spend
    ? records.reduce((acc, record) => acc + record.spend, 0)
    : null;

  return {
    totalCount: records.length,
    totalSpend,
  };
}


