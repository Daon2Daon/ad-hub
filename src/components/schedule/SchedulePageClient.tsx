"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import {
  CampaignFormModal,
  EMPTY_CAMPAIGN_FORM_STATE,
  REQUIRED_CREATE_COLUMNS,
  type CampaignFormState,
} from "@/components/management/CampaignFormModal";
import {
  ScheduleCalendar,
  ScheduleGanttMonth,
  buildCalendarData,
  buildInitialMonthWindow,
  buildMonthGanttData,
  MONTH_WINDOW_CHUNK,
  MAX_MONTH_WINDOW,
  type ExtendTimelinePayload,
  type ScrollAlign,
} from "@/components/schedule/ScheduleVisualizations";
import { createCampaignAction } from "@/lib/management/actions";
import { mergeManagementOptions } from "@/lib/management/utils";
import { cn } from "@/lib/utils";
import { mergeScheduleOptions } from "@/lib/schedule/utils";
import type {
  ScheduleColumnAccess,
  ScheduleOptions,
  ScheduleRecord,
  ScheduleOptionValues,
} from "@/types/schedule";
import type { ManagementColumnAccess, ManagementOptions } from "@/types/management";

type ScheduleView = "gantt" | "calendar";

interface SchedulePageClientProps {
  records: ScheduleRecord[];
  columnAccess: ScheduleColumnAccess;
  options: ScheduleOptions;
  formColumnAccess: ManagementColumnAccess;
  formOptions: ManagementOptions;
}

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: "gantt", label: "간트 차트" },
  { value: "calendar", label: "캘린더" },
];

const ALL_OPTION = "all";

export const SchedulePageClient = ({
  records,
  columnAccess,
  options,
  formColumnAccess,
  formOptions,
}: SchedulePageClientProps) => {
  const router = useRouter();
  const [view, setView] = useState<ScheduleView>("gantt");
  const [items, setItems] = useState<ScheduleRecord[]>(records);
  const [optionSets, setOptionSets] = useState<ScheduleOptions>(options);
  const [formOptionSets, setFormOptionSets] = useState<ManagementOptions>(formOptions);
  const [formState, setFormState] = useState<CampaignFormState>(EMPTY_CAMPAIGN_FORM_STATE);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [monthWindow, setMonthWindow] = useState(() => buildInitialMonthWindow(startOfMonth(new Date())));
  const [monthScrollRequest, setMonthScrollRequest] = useState<{ key: string; align: ScrollAlign } | null>(null);
  const [monthScrollSignal, setMonthScrollSignal] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<string>(ALL_OPTION);
  const [selectedAgency, setSelectedAgency] = useState<string>(ALL_OPTION);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const initialScrollDoneRef = useRef(false);

  const ensureMonthWithinWindow = useCallback((target: Date) => {
    setMonthWindow((prev) => {
      const targetStart = startOfMonth(target);
      let nextStart = prev.start;
      let nextCount = prev.count;

      if (targetStart < nextStart) {
        while (targetStart < nextStart && nextCount < MAX_MONTH_WINDOW) {
          const addable = Math.min(MONTH_WINDOW_CHUNK, MAX_MONTH_WINDOW - nextCount);
          nextStart = subMonths(nextStart, addable);
          nextCount += addable;
        }
        if (targetStart < nextStart && nextCount === MAX_MONTH_WINDOW) {
          nextStart = targetStart;
        }
      }

      let currentEnd = addMonths(nextStart, nextCount - 1);

      if (targetStart > currentEnd) {
        while (targetStart > currentEnd && nextCount < MAX_MONTH_WINDOW) {
          const addable = Math.min(MONTH_WINDOW_CHUNK, MAX_MONTH_WINDOW - nextCount);
          nextCount += addable;
          currentEnd = addMonths(nextStart, nextCount - 1);
        }

        if (targetStart > currentEnd && nextCount === MAX_MONTH_WINDOW) {
          nextStart = subMonths(targetStart, nextCount - 1);
        }
      }

      return { start: nextStart, count: nextCount };
    });
  }, []);

  const requestMonthScroll = useCallback((target: Date, align: ScrollAlign = "start") => {
    setMonthScrollRequest({
      key: format(startOfMonth(target), "yyyy-MM"),
      align,
    });
    setMonthScrollSignal((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (initialScrollDoneRef.current) {
      return;
    }
    initialScrollDoneRef.current = true;
    requestMonthScroll(subMonths(startOfMonth(new Date()), 1));
  }, [requestMonthScroll]);

  const handleExtendMonthWindow = useCallback(
    ({ direction, months }: ExtendTimelinePayload) => {
      let monthsAdded = 0;
      setMonthWindow((prev) => {
        if (direction === "backward") {
          if (prev.count >= MAX_MONTH_WINDOW) {
            return prev;
          }
          const allowed = Math.min(months, MAX_MONTH_WINDOW - prev.count);
          if (allowed <= 0) {
            return prev;
          }
          monthsAdded = allowed;
          return {
            start: subMonths(prev.start, allowed),
            count: prev.count + allowed,
          };
        }

        if (prev.count >= MAX_MONTH_WINDOW) {
          return prev;
        }

        const allowed = Math.min(months, MAX_MONTH_WINDOW - prev.count);
        if (allowed <= 0) {
          return prev;
        }

        monthsAdded = allowed;

        return {
          ...prev,
          count: prev.count + allowed,
        };
      });
      return monthsAdded;
    },
    [],
  );

  useEffect(() => {
    setItems(records);
  }, [records]);

  useEffect(() => {
    setOptionSets(options);
  }, [options]);

  useEffect(() => {
    setFormOptionSets(formOptions);
  }, [formOptions]);

  const canCreateCampaign = REQUIRED_CREATE_COLUMNS.every((key) => formColumnAccess[key]);

  useEffect(() => {
    if (selectedChannel !== ALL_OPTION && !optionSets.channels.includes(selectedChannel)) {
      setSelectedChannel(ALL_OPTION);
    }
  }, [optionSets.channels, selectedChannel]);

  useEffect(() => {
    if (selectedAgency !== ALL_OPTION && !optionSets.agencies.includes(selectedAgency)) {
      setSelectedAgency(ALL_OPTION);
    }
  }, [optionSets.agencies, selectedAgency]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (
        columnAccess.channel &&
        selectedChannel !== ALL_OPTION &&
        item.channel !== selectedChannel
      ) {
        return false;
      }
      if (columnAccess.agency && selectedAgency !== ALL_OPTION && item.agency !== selectedAgency) {
        return false;
      }
      return true;
    });
  }, [items, columnAccess.channel, columnAccess.agency, selectedChannel, selectedAgency]);

  const monthGanttData = useMemo(
    () => buildMonthGanttData(filteredItems, monthWindow.start, monthWindow.count),
    [filteredItems, monthWindow.start, monthWindow.count],
  );
  const calendarData = useMemo(
    () => buildCalendarData(filteredItems, currentMonth),
    [filteredItems, currentMonth],
  );

  const { execute: createCampaign, isExecuting: isCreating } = useAction(createCampaignAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      const newRecord: ScheduleRecord = {
        id: data.row.id,
        campaign: data.row.campaign,
        creative: data.row.creative,
        channel: data.row.channel,
        department: data.row.department,
        agency: data.row.agency,
        startDate: data.row.startDate,
        endDate: data.row.endDate,
      };

      const scheduleOptionValues: ScheduleOptionValues = {
        campaign: data.optionValues.campaign,
        creative: data.optionValues.creative,
        channel: data.optionValues.channel,
        department: data.optionValues.department,
        agency: data.optionValues.agency,
      };

      setItems((prev) => [...prev, newRecord]);
      setOptionSets((prev) => mergeScheduleOptions(prev, scheduleOptionValues));
      setFormOptionSets((prev) => mergeManagementOptions(prev, data.optionValues));
      setFormOpen(false);
      setFormState(EMPTY_CAMPAIGN_FORM_STATE);
      setFormError(null);
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string"
          ? error.serverError
          : "데이터 등록 중 문제가 발생했습니다.";
      setFormError(message);
    },
  });

  const handleMonthChange = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const next = direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1);
      ensureMonthWithinWindow(next);
      requestMonthScroll(next);
      return next;
    });
  };

  const handleResetMonth = () => {
    const todayMonth = startOfMonth(new Date());
    const previousMonth = subMonths(todayMonth, 1);
    setCurrentMonth(todayMonth);
    ensureMonthWithinWindow(previousMonth);
    requestMonthScroll(previousMonth);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (isCreating) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const campaignInput = formData.get("campaign")?.toString().trim() ?? "";
    const creativeInput = formData.get("creative")?.toString().trim() ?? "";
    const channelInput = formData.get("channel")?.toString().trim() ?? "";
    const budgetAccountInput = formData.get("budgetAccount")?.toString().trim() ?? "";
    const departmentInput = formData.get("department")?.toString().trim() ?? "";
    const agencyInput = formData.get("agency")?.toString().trim() ?? "";
    const startInput = formData.get("startDate")?.toString().trim() ?? "";
    const endInput = formData.get("endDate")?.toString().trim() ?? "";
    const spendInput = formData.get("spend")?.toString().trim() ?? "";

    if (formColumnAccess.campaign && !campaignInput) {
      setFormError("캠페인을 입력해주세요.");
      return;
    }

    if (formColumnAccess.channel && !channelInput) {
      setFormError("매체/구분을 입력해주세요.");
      return;
    }

    if (formColumnAccess.budgetAccount && !budgetAccountInput) {
      setFormError("예산계정을 입력해주세요.");
      return;
    }

    if (formColumnAccess.department && !departmentInput) {
      setFormError("담당부서를 입력해주세요.");
      return;
    }

    if (formColumnAccess.agency && !agencyInput) {
      setFormError("대행사를 입력해주세요.");
      return;
    }

    if (!startInput || !endInput) {
      setFormError("시작일과 종료일을 모두 입력해주세요.");
      return;
    }

    const startDate = new Date(startInput);
    const endDate = new Date(endInput);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setFormError("날짜 형식이 올바르지 않습니다.");
      return;
    }

    if (startDate > endDate) {
      setFormError("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    const spendValue = formColumnAccess.spend && spendInput !== "" ? Number(spendInput) : undefined;

    if (spendValue !== undefined && Number.isNaN(spendValue)) {
      setFormError("광고비는 숫자로 입력해주세요.");
      return;
    }

    createCampaign({
      campaign: campaignInput,
      creative: creativeInput || undefined,
      channel: channelInput,
      budgetAccount: budgetAccountInput || undefined,
      department: departmentInput,
      agency: agencyInput,
      startDate,
      endDate,
      spend: spendValue,
    });
  };

  const handleFilterReset = () => {
    setSelectedChannel(ALL_OPTION);
    setSelectedAgency(ALL_OPTION);
  };

  const renderView = () => {
    if (!columnAccess.schedule) {
      return (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          일정에 접근할 수 있는 권한이 없습니다. 관리자에게 권한을 요청해주세요.
        </section>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          선택한 조건에 맞는 캠페인 일정이 없습니다. 필터를 조정하거나 새로운 일정을 추가해보세요.
        </section>
      );
    }

    if (view === "gantt") {
      return (
        <ScheduleGanttMonth
          {...monthGanttData}
          columnAccess={columnAccess}
          onExtendTimeline={handleExtendMonthWindow}
          scrollTargetKey={monthScrollRequest?.key ?? null}
          scrollAlign={monthScrollRequest?.align ?? "start"}
          scrollSignal={monthScrollSignal}
        />
      );
    }

    return <ScheduleCalendar {...calendarData} columnAccess={columnAccess} />;
  };

  const isFilterPristine = selectedChannel === ALL_OPTION && selectedAgency === ALL_OPTION;
  const monthRangeLabel = `${format(startOfMonth(currentMonth), "yyyy.MM.dd")} ~ ${format(
    endOfMonth(currentMonth),
    "yyyy.MM.dd",
  )}`;

  useEffect(() => {
    if (!isFilterPristine && !isFilterPanelOpen) {
      setIsFilterPanelOpen(true);
    }
  }, [isFilterPristine, isFilterPanelOpen]);

  return (
    <section className="flex flex-col gap-4 md:gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                view === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:space-y-4 md:p-6">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-3 md:hidden">
          {/* Date Navigation - Mobile */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => handleMonthChange("prev")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="이전 달"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="flex-1 text-center text-sm font-semibold text-slate-800">
                {format(currentMonth, "yyyy년 M월")}
              </span>
              <button
                type="button"
                onClick={() => handleMonthChange("next")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="다음 달"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={handleResetMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              오늘
            </button>
          </div>

          {/* Info and Filter - Mobile */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              총 {filteredItems.length.toLocaleString("ko-KR")}건
            </span>
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition",
                isFilterPanelOpen
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
              aria-expanded={isFilterPanelOpen}
              aria-label="필터"
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden flex-col gap-3 md:flex lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleMonthChange("prev")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="이전 달"
            >
              이전 달
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {format(currentMonth, "yyyy년 M월")}
            </span>
            <button
              type="button"
              onClick={() => handleMonthChange("next")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="다음 달"
            >
              다음 달
            </button>
            <button
              type="button"
              onClick={handleResetMonth}
              className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              오늘
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                isFilterPanelOpen
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
              aria-expanded={isFilterPanelOpen}
            >
              필터
            </button>
            <button
              type="button"
              onClick={() => {
                setFormState(EMPTY_CAMPAIGN_FORM_STATE);
                setFormError(null);
                setFormOpen(true);
              }}
              disabled={!canCreateCampaign}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                canCreateCampaign
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "cursor-not-allowed bg-slate-200 text-slate-500",
              )}
            >
              신규 등록
            </button>
          </div>
        </div>

        {isFilterPanelOpen ? (
          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FilterControl
                label="매체/구분"
                value={selectedChannel}
                onChange={setSelectedChannel}
                options={optionSets.channels}
                disabled={!columnAccess.channel}
                placeholder="전체 매체/구분"
              />
              <FilterControl
                label="대행사"
                value={selectedAgency}
                onChange={setSelectedAgency}
                options={optionSets.agencies}
                disabled={!columnAccess.agency}
                placeholder="전체 대행사"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleFilterReset}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                disabled={isFilterPristine}
              >
                필터 초기화
              </button>
            </div>
          </div>
        ) : null}

        {/* Desktop Info */}
        <div className="hidden flex-col gap-1 text-sm text-slate-600 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <span>기간: {monthRangeLabel}</span>
          <span>총 {filteredItems.length.toLocaleString("ko-KR")}건</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        {renderView()}
      </div>

      {/* Mobile FAB - 신규 등록 */}
      <button
        type="button"
        onClick={() => {
          setFormState(EMPTY_CAMPAIGN_FORM_STATE);
          setFormError(null);
          setFormOpen(true);
        }}
        disabled={!canCreateCampaign}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition md:hidden",
          canCreateCampaign
            ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
            : "cursor-not-allowed bg-slate-200 text-slate-500",
        )}
        aria-label="신규 등록"
      >
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      <CampaignFormModal
        open={formOpen}
        mode="create"
        title="신규 등록"
        onClose={() => {
          setFormOpen(false);
          setFormError(null);
          setFormState(EMPTY_CAMPAIGN_FORM_STATE);
        }}
        onSubmit={handleFormSubmit}
        formState={formState}
        setFormState={setFormState}
        columnAccess={formColumnAccess}
        options={formOptionSets}
        isSubmitting={isCreating}
        errorMessage={formError}
      />
    </section>
  );
};

interface FilterControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled: boolean;
  placeholder: string;
}

const FilterControl = ({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: FilterControlProps) => {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      <span className="text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value={ALL_OPTION}>{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
};
