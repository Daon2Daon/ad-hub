import type { ColumnKey } from "@/types/auth";

export type ReportColumnKey =
  | Extract<ColumnKey, "campaign">
  | Extract<ColumnKey, "creative">
  | Extract<ColumnKey, "channel">
  | Extract<ColumnKey, "schedule">
  | Extract<ColumnKey, "spend">
  | Extract<ColumnKey, "budgetAccount">
  | Extract<ColumnKey, "department">
  | Extract<ColumnKey, "agency">;

export type ReportColumnAccess = Record<ReportColumnKey, boolean>;

export interface ReportRow {
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

export interface ReportOptions {
  campaigns: string[];
  creatives: string[];
  channels: string[];
  departments: string[];
  agencies: string[];
  budgetAccounts: string[];
}

export interface ReportFilters {
  startDate: string | null;
  endDate: string | null;
  campaign: string | null;
  creative: string | null;
  channel: string | null;
  department: string | null;
  agency: string | null;
  budgetAccount: string | null;
}

export interface ReportSummary {
  totalCount: number;
  totalSpend: number | null;
}












