import type { Dispatch, FormEvent, SetStateAction } from "react";

import { cn } from "@/lib/utils";
import type { ManagementColumnAccess, ManagementOptions } from "@/types/management";

export const REQUIRED_CREATE_COLUMNS: (keyof ManagementColumnAccess)[] = [
  "campaign",
  "channel",
  "schedule",
  "department",
  "agency",
  "budgetAccount",
  "spend",
];

export type CampaignFormState = {
  campaign: string;
  creative: string;
  channel: string;
  budgetAccount: string;
  department: string;
  agency: string;
  startDate: string;
  endDate: string;
  spend: string;
};

export const EMPTY_CAMPAIGN_FORM_STATE: CampaignFormState = {
  campaign: "",
  creative: "",
  channel: "",
  budgetAccount: "",
  department: "",
  agency: "",
  startDate: "",
  endDate: "",
  spend: "0",
};

export interface CampaignFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formState: CampaignFormState;
  setFormState: Dispatch<SetStateAction<CampaignFormState>>;
  columnAccess: ManagementColumnAccess;
  options: ManagementOptions;
  isSubmitting: boolean;
  fieldErrors?: Partial<Record<keyof CampaignFormState, string>>;
}

export const CampaignFormModal = ({
  open,
  mode,
  title,
  onClose,
  onSubmit,
  formState,
  setFormState,
  columnAccess,
  options,
  isSubmitting,
  fieldErrors = {},
}: CampaignFormModalProps) => {
  if (!open) {
    return null;
  }

  const handleChange = (field: keyof CampaignFormState) => (value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {columnAccess.campaign ? (
              <Field
                label="캠페인 (선택)"
                name="campaign"
                placeholder="캠페인 이름"
                value={formState.campaign}
                onChange={handleChange("campaign")}
                disabled={isSubmitting}
                options={options.campaigns}
                error={fieldErrors.campaign}
              />
            ) : null}

            {columnAccess.creative ? (
              <Field
                label="소재"
                name="creative"
                placeholder="소재 이름"
                value={formState.creative}
                onChange={handleChange("creative")}
                disabled={isSubmitting}
                options={options.creatives}
                required
                error={fieldErrors.creative}
              />
            ) : null}

            {columnAccess.channel ? (
              <Field
                label="매체/구분"
                name="channel"
                placeholder="예: 디스플레이"
                value={formState.channel}
                onChange={handleChange("channel")}
                disabled={isSubmitting}
                required
                options={options.channels}
                error={fieldErrors.channel}
              />
            ) : null}

            {columnAccess.spend ? (
              <div className="space-y-2">
                <label htmlFor="spend" className="block text-sm font-medium text-slate-700">
                  광고비 (원)
                </label>
                <input
                  id="spend"
                  name="spend"
                  type="number"
                  min={0}
                  step={1}
                  value={formState.spend}
                  onChange={(event) => handleChange("spend")(event.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100",
                    fieldErrors.spend
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                      : "border-slate-200 focus:border-slate-400 focus:ring-slate-200",
                  )}
                />
                {fieldErrors.spend ? (
                  <p className="text-xs text-rose-600">{fieldErrors.spend}</p>
                ) : null}
              </div>
            ) : null}

            {columnAccess.schedule ? (
              <div className="space-y-2">
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
                  시작일
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  value={formState.startDate}
                  onChange={(event) => handleChange("startDate")(event.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100",
                    fieldErrors.startDate
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                      : "border-slate-200 focus:border-slate-400 focus:ring-slate-200",
                  )}
                />
                {fieldErrors.startDate ? (
                  <p className="text-xs text-rose-600">{fieldErrors.startDate}</p>
                ) : null}
              </div>
            ) : null}

            {columnAccess.schedule ? (
              <div className="space-y-2">
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">
                  종료일
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  value={formState.endDate}
                  onChange={(event) => handleChange("endDate")(event.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100",
                    fieldErrors.endDate
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                      : "border-slate-200 focus:border-slate-400 focus:ring-slate-200",
                  )}
                />
                {fieldErrors.endDate ? (
                  <p className="text-xs text-rose-600">{fieldErrors.endDate}</p>
                ) : null}
              </div>
            ) : null}

            {columnAccess.department ? (
              <Field
                label="담당팀"
                name="department"
                placeholder="담당 부서"
                value={formState.department}
                onChange={handleChange("department")}
                disabled={isSubmitting}
                required
                options={options.departments}
                error={fieldErrors.department}
              />
            ) : null}

            {columnAccess.agency ? (
              <Field
                label="대행사"
                name="agency"
                placeholder="대행사"
                value={formState.agency}
                onChange={handleChange("agency")}
                disabled={isSubmitting}
                required
                options={options.agencies}
                error={fieldErrors.agency}
              />
            ) : null}

            {columnAccess.budgetAccount ? (
              <div className="sm:col-span-2">
                <Field
                  label="예산계정"
                  name="budgetAccount"
                  placeholder="예산 계정"
                  value={formState.budgetAccount}
                  onChange={handleChange("budgetAccount")}
                  disabled={isSubmitting}
                  required
                  options={options.budgetAccounts}
                  error={fieldErrors.budgetAccount}
                />
              </div>
            ) : null}
          </div>

          <footer className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50",
                isSubmitting && "cursor-not-allowed opacity-70",
              )}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                isSubmitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isSubmitting ? "처리 중..." : mode === "create" ? "등록" : "저장"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: string[];
  required?: boolean;
  error?: string;
}

const Field = ({
  label,
  name,
  placeholder,
  value,
  onChange,
  disabled,
  options,
  required,
  error,
}: FieldProps) => {
  const datalistId = `${name}-options`;

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {required && !disabled ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(required && !disabled)}
        disabled={disabled}
        list={datalistId}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100",
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
            : "border-slate-200 focus:border-slate-400 focus:ring-slate-200",
        )}
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
};
