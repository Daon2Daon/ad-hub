import type { ColumnKey } from "@/types/auth";

export type ManagementColumnKey =
  | Extract<ColumnKey, "campaign">
  | Extract<ColumnKey, "creative">
  | Extract<ColumnKey, "channel">
  | Extract<ColumnKey, "schedule">
  | Extract<ColumnKey, "spend">
  | Extract<ColumnKey, "budgetAccount">
  | Extract<ColumnKey, "department">
  | Extract<ColumnKey, "agency">;

export type ManagementColumnAccess = Record<ManagementColumnKey, boolean>;

export interface ManagementRow {
  id: string;
  campaign: string;
  creative: string;
  channel: string;
  startDate: string | null;
  endDate: string | null;
  spend: number | null;
  budgetAccount: string;
  department: string;
  agency: string;
}

export interface ManagementOptions {
  campaigns: string[];
  creatives: string[];
  channels: string[];
  budgetAccounts: string[];
  departments: string[];
  agencies: string[];
}

export interface ManagementOptionValues {
  campaign: string | null;
  creative: string | null;
  channel: string | null;
  budgetAccount: string | null;
  department: string | null;
  agency: string | null;
}
