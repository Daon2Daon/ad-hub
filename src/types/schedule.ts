import type { ColumnKey } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";

export type ScheduleColumnKey =
  | Extract<ColumnKey, "campaign">
  | Extract<ColumnKey, "creative">
  | Extract<ColumnKey, "channel">
  | Extract<ColumnKey, "schedule">
  | Extract<ColumnKey, "department">
  | Extract<ColumnKey, "agency">;

export interface ScheduleRecord
  extends Pick<
    CampaignRecord,
    "id" | "campaign" | "creative" | "channel" | "department" | "agency"
  > {
  startDate: string | null;
  endDate: string | null;
}

export type ScheduleColumnAccess = Record<ScheduleColumnKey, boolean>;

export interface ScheduleOptions {
  campaigns: string[];
  creatives: string[];
  channels: string[];
  departments: string[];
  agencies: string[];
}

export interface ScheduleOptionValues {
  campaign: string | null;
  creative: string | null;
  channel: string | null;
  department: string | null;
  agency: string | null;
}
