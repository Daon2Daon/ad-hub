import { hasColumnAccess } from "@/lib/auth/permissions";
import type { UserAccessProfile } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";
import type {
  ManagementColumnAccess,
  ManagementOptions,
  ManagementOptionValues,
  ManagementRow,
} from "@/types/management";

export function buildManagementColumnAccess(profile: UserAccessProfile): ManagementColumnAccess {
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

export function toManagementRow(
  record: CampaignRecord,
  columnAccess: ManagementColumnAccess,
): ManagementRow {
  return {
    id: record.id,
    campaign: columnAccess.campaign ? record.campaign : "권한 없음",
    creative: columnAccess.creative ? record.creative : "권한 없음",
    channel: columnAccess.channel ? record.channel : "권한 없음",
    startDate: columnAccess.schedule ? record.startDate : null,
    endDate: columnAccess.schedule ? record.endDate : null,
    spend: columnAccess.spend ? record.spend : null,
    budgetAccount: columnAccess.budgetAccount ? record.budgetAccount : "권한 없음",
    department: columnAccess.department ? record.department : "권한 없음",
    agency: columnAccess.agency ? record.agency : "권한 없음",
  };
}

export function buildManagementOptions(
  records: CampaignRecord[],
  columnAccess: ManagementColumnAccess,
): ManagementOptions {
  const unique = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

  return {
    campaigns: columnAccess.campaign ? unique(records.map((record) => record.campaign)) : [],
    creatives: columnAccess.creative ? unique(records.map((record) => record.creative)) : [],
    channels: columnAccess.channel ? unique(records.map((record) => record.channel)) : [],
    budgetAccounts: columnAccess.budgetAccount ? unique(records.map((record) => record.budgetAccount)) : [],
    departments: columnAccess.department ? unique(records.map((record) => record.department)) : [],
    agencies: columnAccess.agency ? unique(records.map((record) => record.agency)) : [],
  };
}

export function mergeManagementOptions(
  current: ManagementOptions,
  values: ManagementOptionValues,
): ManagementOptions {
  const merge = (list: string[], value: string | null) => {
    if (!value) {
      return list;
    }

    if (list.includes(value)) {
      return list;
    }

    return [...list, value].sort((a, b) => a.localeCompare(b));
  };

  return {
    campaigns: merge(current.campaigns, values.campaign),
    creatives: merge(current.creatives, values.creative),
    channels: merge(current.channels, values.channel),
    budgetAccounts: merge(current.budgetAccounts, values.budgetAccount),
    departments: merge(current.departments, values.department),
    agencies: merge(current.agencies, values.agency),
  };
}
