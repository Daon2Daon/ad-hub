import type { Campaign } from "@prisma/client";

import { hasColumnAccess } from "@/lib/auth/permissions";
import type { UserAccessProfile } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";
import type {
  ScheduleColumnAccess,
  ScheduleOptionValues,
  ScheduleOptions,
  ScheduleRecord,
} from "@/types/schedule";

export function buildScheduleColumnAccess(profile: UserAccessProfile): ScheduleColumnAccess {
  return {
    campaign: hasColumnAccess(profile, "campaign"),
    creative: hasColumnAccess(profile, "creative"),
    channel: hasColumnAccess(profile, "channel"),
    schedule: hasColumnAccess(profile, "schedule"),
    department: hasColumnAccess(profile, "department"),
    agency: hasColumnAccess(profile, "agency"),
  };
}

export function mapCampaignModelToRecord(campaign: Campaign): CampaignRecord {
  return {
    id: campaign.id,
    campaign: campaign.campaign,
    creative: campaign.creative,
    channel: campaign.channel,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    spend: Number(campaign.spend),
    budgetAccount: campaign.budgetAccount,
    department: campaign.department,
    agency: campaign.agency,
  };
}

export function toScheduleRecord(
  record: CampaignRecord,
  columnAccess: ScheduleColumnAccess,
): ScheduleRecord {
  return {
    id: record.id,
    campaign: columnAccess.campaign ? record.campaign : "권한 없음",
    creative: columnAccess.creative ? record.creative : "권한 없음",
    channel: columnAccess.channel ? record.channel : "권한 없음",
    department: columnAccess.department ? record.department : "권한 없음",
    agency: columnAccess.agency ? record.agency : "권한 없음",
    startDate: columnAccess.schedule ? record.startDate : null,
    endDate: columnAccess.schedule ? record.endDate : null,
  };
}

export function buildScheduleOptions(
  records: CampaignRecord[],
  columnAccess: ScheduleColumnAccess,
): ScheduleOptions {
  const unique = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

  return {
    campaigns: columnAccess.campaign ? unique(records.map((record) => record.campaign)) : [],
    creatives: columnAccess.creative ? unique(records.map((record) => record.creative)) : [],
    channels: columnAccess.channel ? unique(records.map((record) => record.channel)) : [],
    departments: columnAccess.department ? unique(records.map((record) => record.department)) : [],
    agencies: columnAccess.agency ? unique(records.map((record) => record.agency)) : [],
  };
}

export function mergeScheduleOptions(
  current: ScheduleOptions,
  values: ScheduleOptionValues,
): ScheduleOptions {
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
    departments: merge(current.departments, values.department),
    agencies: merge(current.agencies, values.agency),
  };
}


