"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import type { ReportColumnAccess, ReportFilters, ReportOptions, ReportRow, ReportSummary } from "@/types/report";

interface ReportPageClientProps {
  rows: ReportRow[];
  columnAccess: ReportColumnAccess;
  options: ReportOptions;
  summary: ReportSummary;
}

type SingleValueFilterKey = Exclude<keyof ReportFilters, "startDate" | "endDate">;

const SINGLE_VALUE_FILTER_KEYS: SingleValueFilterKey[] = [
  "campaign",
  "creative",
  "channel",
  "department",
  "agency",
  "budgetAccount",
];

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const DATE_LABEL_FORMAT = "yyyy.MM.dd";

function createFilterState(): ReportFilters {
  return {
    startDate: null,
    endDate: null,
    campaign: null,
    creative: null,
    channel: null,
    department: null,
    agency: null,
    budgetAccount: null,
  };
}

function overlapsPeriod(
  row: ReportRow,
  filters: Pick<ReportFilters, "startDate" | "endDate">,
): boolean {
  if (!filters.startDate || !filters.endDate) {
    return true;
  }

  if (!row.startDate || !row.endDate) {
    return false;
  }

  try {
    const filterStart = parseISO(filters.startDate);
    const filterEnd = parseISO(filters.endDate);
    const rowStart = parseISO(row.startDate);
    const rowEnd = parseISO(row.endDate);

    return rowStart <= filterEnd && rowEnd >= filterStart;
  } catch {
    return false;
  }
}

function formatPeriod(row: ReportRow, hasAccess: boolean): string {
  if (!hasAccess) {
    return "권한 없음";
  }

  if (!row.startDate || !row.endDate) {
    return "일정 정보 없음";
  }

  try {
    const start = format(parseISO(row.startDate), DATE_LABEL_FORMAT);
    const end = format(parseISO(row.endDate), DATE_LABEL_FORMAT);
    return `${start} ~ ${end}`;
  } catch {
    return "일정 정보 없음";
  }
}

function createCsvValue(value: string) {
  const safeValue = value.replace(/"/g, '""');
  if (safeValue.includes(",") || safeValue.includes("\n") || safeValue.includes('"')) {
    return `"${safeValue}"`;
  }
  return safeValue;
}

function formatDateCell(value: string | null): string {
  if (!value) {
    return "권한 없음";
  }

  try {
    return format(parseISO(value), DATE_LABEL_FORMAT);
  } catch {
    return "권한 없음";
  }
}

export const ReportPageClient = ({ rows, columnAccess, options, summary }: ReportPageClientProps) => {
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(() => createFilterState());
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => createFilterState());
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  const columnDescriptors = useMemo(
    () => [
      {
        key: "campaign" as const,
        label: "캠페인",
        visible: columnAccess.campaign,
        align: "left" as const,
        render: (row: ReportRow) => row.campaign,
      },
      {
        key: "creative" as const,
        label: "소재",
        visible: columnAccess.creative,
        align: "left" as const,
        render: (row: ReportRow) => row.creative,
      },
      {
        key: "channel" as const,
        label: "매체/구분",
        visible: columnAccess.channel,
        align: "left" as const,
        render: (row: ReportRow) => row.channel,
      },
      {
        key: "schedule" as const,
        label: "일정 (시작/종료)",
        visible: columnAccess.schedule,
        align: "left" as const,
        render: (row: ReportRow) => formatPeriod(row, columnAccess.schedule),
      },
      {
        key: "spend" as const,
        label: "광고비",
        visible: columnAccess.spend,
        align: "right" as const,
        render: (row: ReportRow) =>
          row.spend !== null ? currencyFormatter.format(row.spend) : "권한 없음",
      },
      {
        key: "budgetAccount" as const,
        label: "예산계정",
        visible: columnAccess.budgetAccount,
        align: "left" as const,
        render: (row: ReportRow) => row.budgetAccount,
      },
      {
        key: "department" as const,
        label: "담당팀",
        visible: columnAccess.department,
        align: "left" as const,
        render: (row: ReportRow) => row.department,
      },
      {
        key: "agency" as const,
        label: "대행사",
        visible: columnAccess.agency,
        align: "left" as const,
        render: (row: ReportRow) => row.agency,
      },
    ],
    [columnAccess],
  );

  const visibleColumns = useMemo(
    () => columnDescriptors.filter((column) => column.visible),
    [columnDescriptors],
  );

  const filteredRows = useMemo(() => {
    const hasActiveFilters =
      appliedFilters.startDate ||
      appliedFilters.endDate ||
      SINGLE_VALUE_FILTER_KEYS.some((key) => appliedFilters[key] !== null);

    if (!hasActiveFilters) {
      return rows;
    }

    return rows.filter((row) => {
      if (
        columnAccess.schedule &&
        !overlapsPeriod(row, { startDate: appliedFilters.startDate, endDate: appliedFilters.endDate })
      ) {
        return false;
      }

      for (const key of SINGLE_VALUE_FILTER_KEYS) {
        const selected = appliedFilters[key];
        if (!selected) {
          continue;
        }

        const isColumnVisible = columnAccess[key as keyof ReportColumnAccess];
        if (!isColumnVisible) {
          continue;
        }

        const rowValue = row[key as keyof ReportRow];
        if (typeof rowValue === "string" && rowValue !== selected) {
          return false;
        }
      }

      return true;
    });
  }, [appliedFilters, columnAccess, rows]);

  const filteredSummary = useMemo(() => {
    const totalCount = filteredRows.length;
    const totalSpend =
      columnAccess.spend && filteredRows.length > 0
        ? filteredRows.reduce((acc, row) => acc + (row.spend ?? 0), 0)
        : columnAccess.spend
          ? 0
          : null;

    return { totalCount, totalSpend };
  }, [filteredRows, columnAccess.spend]);

  const handleDateChange = useCallback((field: "startDate" | "endDate", value: string | null) => {
    setDraftFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSelectChange = useCallback((key: SingleValueFilterKey, value: string) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value === "" ? null : value,
    }));
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (
        columnAccess.schedule &&
        ((draftFilters.startDate && !draftFilters.endDate) ||
          (!draftFilters.startDate && draftFilters.endDate))
      ) {
        alert("조회 기간을 설정하려면 시작일과 종료일을 모두 선택해주세요.");
        return;
      }

      setAppliedFilters(draftFilters);
    },
    [draftFilters, columnAccess.schedule],
  );

  const handleReset = useCallback(() => {
    const next = createFilterState();
    setDraftFilters(next);
    setAppliedFilters(next);
  }, []);

  const handleExport = useCallback(() => {
    if (visibleColumns.length === 0 || filteredRows.length === 0) {
      return;
    }

    const headerRow = visibleColumns.flatMap((column) => {
      if (column.key === "schedule") {
        return ["시작일", "종료일"];
      }
      return [column.label];
    });

    const rowsForExport = filteredRows.map((row) =>
      visibleColumns.flatMap((column) => {
        if (column.key === "schedule") {
          return [
            columnAccess.schedule ? formatDateCell(row.startDate) : "권한 없음",
            columnAccess.schedule ? formatDateCell(row.endDate) : "권한 없음",
          ];
        }
        if (column.key === "spend") {
          return [row.spend !== null ? currencyFormatter.format(row.spend) : "권한 없음"];
        }
        return [String(column.render(row))];
      }),
    );

    const csvContent = [headerRow, ...rowsForExport]
      .map((line) => line.map(createCsvValue).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [filteredRows, visibleColumns, columnAccess.schedule]);

  const canExport = visibleColumns.length > 0 && filteredRows.length > 0;
  const hasColumnVisibility = visibleColumns.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            aria-expanded={isFilterOpen}
          >
            <FilterIcon className="h-4 w-4 text-slate-500" />
            <span>필터</span>
            <ChevronIcon
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                isFilterOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            초기화
          </button>
        </header>

        {isFilterOpen ? (
          <form className="flex flex-col gap-8 px-6 py-6" onSubmit={handleSubmit}>
            <section className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-700">기간</h3>
              <div className="flex flex-col gap-6 lg:flex-row">
                <DatePartsInput
                  label="시작일"
                  value={draftFilters.startDate}
                  onChange={(value) => handleDateChange("startDate", value)}
                  disabled={!columnAccess.schedule}
                />
                <span className="hidden items-center text-sm font-medium text-slate-400 lg:flex">~</span>
                <DatePartsInput
                  label="종료일"
                  value={draftFilters.endDate}
                  onChange={(value) => handleDateChange("endDate", value)}
                  disabled={!columnAccess.schedule}
                />
              </div>
              {!columnAccess.schedule ? (
                <p className="text-xs text-slate-400">
                  일정 컬럼 접근 권한이 없어 기간 필터를 사용할 수 없습니다.
                </p>
              ) : null}
            </section>

            <section className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-700">조건</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FilterSelect
                  label="캠페인"
                  value={draftFilters.campaign}
                  onChange={(value) => handleSelectChange("campaign", value)}
                  options={options.campaigns}
                  disabled={!columnAccess.campaign}
                />
                <FilterSelect
                  label="소재"
                  value={draftFilters.creative}
                  onChange={(value) => handleSelectChange("creative", value)}
                  options={options.creatives}
                  disabled={!columnAccess.creative}
                />
                <FilterSelect
                  label="매체/구분"
                  value={draftFilters.channel}
                  onChange={(value) => handleSelectChange("channel", value)}
                  options={options.channels}
                  disabled={!columnAccess.channel}
                />
                <FilterSelect
                  label="담당팀"
                  value={draftFilters.department}
                  onChange={(value) => handleSelectChange("department", value)}
                  options={options.departments}
                  disabled={!columnAccess.department}
                />
                <FilterSelect
                  label="대행사"
                  value={draftFilters.agency}
                  onChange={(value) => handleSelectChange("agency", value)}
                  options={options.agencies}
                  disabled={!columnAccess.agency}
                />
                <FilterSelect
                  label="예산계정"
                  value={draftFilters.budgetAccount}
                  onChange={(value) => handleSelectChange("budgetAccount", value)}
                  options={options.budgetAccounts}
                  disabled={!columnAccess.budgetAccount}
                />
              </div>
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                현재 전체 데이터 수: {summary.totalCount.toLocaleString("ko-KR")}건
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  초기화
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  조회
                </button>
              </div>
            </footer>
          </form>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">조회 결과</h2>
            <p className="text-sm text-slate-500">
              필터 조건에 맞는 데이터를 표 형태로 제공합니다. 엑셀 다운로드를 통해 CSV 파일로 저장할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
              canExport
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "cursor-not-allowed bg-slate-200 text-slate-500",
            )}
          >
            엑셀 다운로드
          </button>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <SummaryCard
            title="조회된 캠페인 수"
            value={`${filteredSummary.totalCount.toLocaleString("ko-KR")}건`}
            helper="현재 필터 조건으로 조회된 데이터 건수"
          />
          <SummaryCard
            title="총 광고비"
            value={
              filteredSummary.totalSpend !== null
                ? currencyFormatter.format(filteredSummary.totalSpend)
                : "권한 없음"
            }
            helper={
              filteredSummary.totalSpend !== null
                ? "조회 범위 광고비 합계"
                : "광고비 컬럼 권한이 없어 합계를 계산할 수 없습니다."
            }
          />
        </div>

        {!hasColumnVisibility ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            열람 가능한 컬럼 권한이 없어 테이블을 표시할 수 없습니다. 관리자에게 컬럼 접근 권한을 요청해주세요.
          </section>
        ) : filteredRows.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            선택한 조건에 해당하는 데이터가 없습니다. 필터를 조정해 다시 조회해보세요.
          </section>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
                        column.align === "right" && "text-right",
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50">
                    {visibleColumns.map((column) => (
                      <td
                        key={`${row.id}-${column.key}`}
                        className={cn(
                          "px-4 py-3 text-sm text-slate-700",
                          column.align === "right" && "text-right",
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

interface SummaryCardProps {
  title: string;
  value: string;
  helper: string;
}

const SummaryCard = ({ title, value, helper }: SummaryCardProps) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
};

interface FilterSelectProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: string[];
  disabled: boolean;
}

const FilterSelect = ({ label, value, onChange, options, disabled }: FilterSelectProps) => {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">전체</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <ChevronIcon className="h-4 w-4" />
        </span>
      </div>
    </label>
  );
};

interface DatePartsInputProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
}

const DatePartsInput = ({ label, value, onChange, disabled }: DatePartsInputProps) => {
  const parts = useMemo(() => parseDateParts(value), [value]);

  const handlePartChange = useCallback(
    (part: "year" | "month" | "day", event: ChangeEvent<HTMLInputElement>) => {
      const sanitized = event.target.value.replace(/\D/g, "");
      const nextParts = { ...parts, [part]: sanitized };
      const normalized = normalizeDateParts(nextParts);
      onChange(normalized);
    },
    [parts, onChange],
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <DateSegmentInput
          value={parts.year}
          onChange={(event) => handlePartChange("year", event)}
          maxLength={4}
          placeholder="YYYY"
          suffix="년"
          disabled={disabled}
        />
        <DateSegmentInput
          value={parts.month}
          onChange={(event) => handlePartChange("month", event)}
          maxLength={2}
          placeholder="MM"
          suffix="월"
          disabled={disabled}
        />
        <DateSegmentInput
          value={parts.day}
          onChange={(event) => handlePartChange("day", event)}
          maxLength={2}
          placeholder="DD"
          suffix="일"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

interface DateSegmentInputProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  maxLength: number;
  placeholder: string;
  suffix: string;
  disabled: boolean;
}

const DateSegmentInput = ({
  value,
  onChange,
  maxLength,
  placeholder,
  suffix,
  disabled,
}: DateSegmentInputProps) => {
  return (
    <label className="flex items-center gap-2">
      <input
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode="numeric"
        disabled={disabled}
        className="h-11 w-24 rounded-lg border border-slate-200 bg-white px-3 text-center text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
      <span className="text-sm font-medium text-slate-500">{suffix}</span>
    </label>
  );
};

interface IconProps {
  className?: string;
}

const FilterIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="M3 4.5h14M5.5 9.5h9M8 14.5h4"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);

interface DateParts {
  year: string;
  month: string;
  day: string;
}

function parseDateParts(value: string | null): DateParts {
  if (!value) {
    return { year: "", month: "", day: "" };
  }

  const [year, month, day] = value.split("-");
  return {
    year: year ?? "",
    month: month ?? "",
    day: day ?? "",
  };
}

function normalizeDateParts(parts: DateParts): string | null {
  if (parts.year.length === 4 && parts.month.length === 2 && parts.day.length === 2) {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  return null;
}
