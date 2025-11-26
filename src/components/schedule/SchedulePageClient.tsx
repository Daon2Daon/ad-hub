"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  differenceInMonths,
  isToday,
  getDate,
} from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import {
  CampaignFormModal,
  EMPTY_CAMPAIGN_FORM_STATE,
  REQUIRED_CREATE_COLUMNS,
  type CampaignFormState,
} from "@/components/management/CampaignFormModal";
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

const COLOR_VARIANTS = [
  { barClass: "bg-indigo-500/90", accentClass: "border-l-indigo-500", badgeClass: "bg-indigo-500" },
  { barClass: "bg-emerald-500/90", accentClass: "border-l-emerald-500", badgeClass: "bg-emerald-500" },
  { barClass: "bg-rose-500/90", accentClass: "border-l-rose-500", badgeClass: "bg-rose-500" },
  { barClass: "bg-amber-500/90", accentClass: "border-l-amber-500", badgeClass: "bg-amber-500" },
  { barClass: "bg-violet-500/90", accentClass: "border-l-violet-500", badgeClass: "bg-violet-500" },
  { barClass: "bg-cyan-500/90", accentClass: "border-l-cyan-500", badgeClass: "bg-cyan-500" },
] as const;

type ColorVariant = (typeof COLOR_VARIANTS)[number];

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function hashString(value: string) {
  return Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getColorVariant(seed: string): ColorVariant {
  const normalized = seed || "default";
  const index = Math.abs(hashString(normalized)) % COLOR_VARIANTS.length;
  return COLOR_VARIANTS[index];
}

const INITIAL_MONTH_COUNT = 24;
const LOAD_MONTH_COUNT = 12;

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

  const [monthRange, setMonthRange] = useState(() => {
    const today = new Date();
    const startDate = subMonths(startOfMonth(today), 12);
    const endDate = addMonths(startOfMonth(today), 12);
    return { start: startDate, end: endDate };
  });

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedChannel, setSelectedChannel] = useState<string>(ALL_OPTION);
  const [selectedAgency, setSelectedAgency] = useState<string>(ALL_OPTION);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  const loadMoreMonths = (direction: "past" | "future") => {
    setMonthRange((prev) => {
      if (direction === "past") {
        return { ...prev, start: subMonths(prev.start, LOAD_MONTH_COUNT) };
      } else {
        return { ...prev, end: addMonths(prev.end, LOAD_MONTH_COUNT) };
      }
    });
  };

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
    () => buildMonthGanttData(filteredItems, monthRange.start, monthRange.end),
    [filteredItems, monthRange],
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
    const newMonth = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);

    if (newMonth < monthRange.start) {
      loadMoreMonths("past");
    }
    if (newMonth > monthRange.end) {
      loadMoreMonths("future");
    }
  };

  const handleResetMonth = () => {
    const today = new Date();
    const oneMonthAgo = subMonths(startOfMonth(today), 1);
    setCurrentMonth(startOfMonth(today));

    if (ganttContainerRef.current && monthGanttData.timeline) {
      const today = new Date();
      const initialScrollMonth = subMonths(startOfMonth(today), 1);
      const monthsSinceStart = differenceInMonths(initialScrollMonth, monthRange.start);

      if (monthsSinceStart >= 0) {
        const scrollPosition = monthsSinceStart * TIMELINE_MONTH_WIDTH;
        ganttContainerRef.current.scrollTo({ left: scrollPosition, behavior: "smooth" });
      }
    }
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
          containerRef={ganttContainerRef}
          onLoadMore={loadMoreMonths}
          monthRange={monthRange}
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
      />
    </section>
  );
};

interface MonthTimelineContext {
  months: Array<{
    key: string;
    year: number;
    month: number;
    label: string;
    startDate: Date;
    endDate: Date;
  }>;
  years: Array<{
    key: string;
    year: number;
    startMonthIndex: number;
    monthCount: number;
  }>;
  monthIndexMap: Record<string, number>;
  todayMarker: {
    monthIndex: number;
    dayOffsetRatio: number;
  } | null;
}

function buildMonthTimelineContext(
  rangeStart: Date,
  rangeEnd: Date,
): MonthTimelineContext {
  const months: MonthTimelineContext["months"] = [];
  const monthIndexMap: Record<string, number> = {};
  const today = new Date();
  let todayMarker: MonthTimelineContext["todayMarker"] = null;

  let currentDate = startOfMonth(rangeStart);
  let index = 0;

  while (currentDate <= rangeEnd) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthLabel = format(currentDate, "M월", { locale: ko });

    months.push({
      key: monthKey,
      year,
      month,
      label: monthLabel,
      startDate: startOfMonth(currentDate),
      endDate: endOfMonth(currentDate),
    });

    monthIndexMap[monthKey] = index;

    if (
      isToday(today) &&
      today.getFullYear() === year &&
      today.getMonth() + 1 === month
    ) {
      const daysInMonth = endOfMonth(currentDate).getDate();
      const dayOfMonth = today.getDate();
      todayMarker = {
        monthIndex: index,
        dayOffsetRatio: (dayOfMonth - 0.5) / daysInMonth,
      };
    }

    currentDate = addMonths(currentDate, 1);
    index++;
  }

  // 연도 그룹화
  const years: MonthTimelineContext["years"] = [];
  if (months.length > 0) {
    let currentYear = months[0].year;
    let yearStartIndex = 0;
    months.forEach((month, i) => {
      if (month.year !== currentYear) {
        years.push({
          key: String(currentYear),
          year: currentYear,
          startMonthIndex: yearStartIndex,
          monthCount: i - yearStartIndex,
        });
        currentYear = month.year;
        yearStartIndex = i;
      }
    });
    years.push({
      key: String(currentYear),
      year: currentYear,
      startMonthIndex: yearStartIndex,
      monthCount: months.length - yearStartIndex,
    });
  }

  return {
    months,
    years,
    monthIndexMap,
    todayMarker,
  };
}

interface MonthGanttData {
  rows: Array<{
    id: string;
    label: string;
    channel: string;
    department: string;
    agency: string;
    startDate: Date | null;
    endDate: Date | null;
    barStartPx: number | null;
    barLengthPx: number | null;
  }>;
  timeline: MonthTimelineContext;
}

function buildMonthGanttData(
  records: ScheduleRecord[],
  rangeStart: Date,
  rangeEnd: Date,
): MonthGanttData {
  const timeline = buildMonthTimelineContext(rangeStart, rangeEnd);

  if (timeline.months.length === 0) {
    return { rows: [], timeline };
  }

  const normalized = records
    .map((record) => {
      if (!record.startDate || !record.endDate) {
        return null;
      }

      const startDate = parseISO(record.startDate);
      const endDate = parseISO(record.endDate);

      // 범위와 겹치는지 확인
      if (endDate < rangeStart || startDate > rangeEnd) {
        return null;
      }

      return {
        record,
        startDate,
        endDate,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const rows = normalized
    .sort(({ record: a, startDate: startA }, { record: b, startDate: startB }) => {
      if (a.channel !== b.channel) {
        return a.channel.localeCompare(b.channel, "ko");
      }
      if (a.campaign !== b.campaign) {
        return a.campaign.localeCompare(b.campaign, "ko");
      }
      const timeA = startA.getTime();
      const timeB = startB.getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return (a.startDate || "").localeCompare(b.startDate || "");
    })
    .map(({ record, startDate, endDate }) => {
      let barStartPx: number | null = null;
      let barLengthPx: number | null = null;

      const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      const endMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;

      const startMonthIndex = timeline.monthIndexMap[startMonthKey];
      const endMonthIndex = timeline.monthIndexMap[endMonthKey];

      if (startMonthIndex !== undefined && endMonthIndex !== undefined) {
        const startMonth = timeline.months[startMonthIndex];
        const endMonth = timeline.months[endMonthIndex];

        const startMonthDays = getDate(endOfMonth(startMonth.startDate));
        const startDay = getDate(startDate);
        const startOffsetRatio = Math.max(0, (startDay - 1) / startMonthDays);

        const endMonthDays = getDate(endOfMonth(endMonth.startDate));
        const endDay = getDate(endDate);
        const endOffsetRatio = Math.min(1, endDay / endMonthDays);

        const startPx = startMonthIndex * TIMELINE_MONTH_WIDTH + startOffsetRatio * TIMELINE_MONTH_WIDTH;
        const endPx = endMonthIndex * TIMELINE_MONTH_WIDTH + endOffsetRatio * TIMELINE_MONTH_WIDTH;

        barStartPx = startPx;
        barLengthPx = Math.max(endPx - startPx, 2); // 최소 너비
      }

      return {
        id: record.id,
        label: record.campaign,
        channel: record.channel,
        department: record.department,
        agency: record.agency,
        startDate: startDate,
        endDate: endDate,
        barStartPx,
        barLengthPx,
      };
    });

  return { rows, timeline };
}

interface CalendarData {
  days: Date[];
  month: Date;
  schedulesByDay: Record<string, ScheduleRecord[]>;
}

function buildCalendarData(records: ScheduleRecord[], month: Date): CalendarData {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const normalized = records
    .map((record) => {
      if (!record.startDate || !record.endDate) {
        return null;
      }
      return {
        record,
        start: startOfDay(parseISO(record.startDate)),
        end: endOfDay(parseISO(record.endDate)),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const schedulesByDay = days.reduce<Record<string, ScheduleRecord[]>>((acc, day) => {
    const key = format(day, "yyyy-MM-dd");

    const matches = normalized
      .filter(({ start, end }) => isWithinInterval(day, { start, end }))
      .map(({ record }) => record);

    acc[key] = matches;
    return acc;
  }, {});

  return {
    days,
    month: monthStart,
    schedulesByDay,
  };
}

interface ScheduleGanttMonthProps extends MonthGanttData {
  columnAccess: ScheduleColumnAccess;
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadMore: (direction: "past" | "future") => void;
  monthRange: { start: Date; end: Date };
}

const TIMELINE_LEFT_WIDTH = 220;
const TIMELINE_LEFT_WIDTH_MOBILE = 160;
const TIMELINE_MONTH_WIDTH = 120;
const TIMELINE_MONTH_WIDTH_MOBILE = 80;

const ScheduleGanttMonth = ({
  rows,
  timeline,
  columnAccess,
  containerRef,
  onLoadMore,
  monthRange,
}: ScheduleGanttMonthProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const initialScrollComplete = useRef(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && !initialScrollComplete.current) {
      const initialScrollMonth = subMonths(startOfMonth(today), 1);
      const monthsSinceStart = differenceInMonths(initialScrollMonth, monthRange.start);

      if (monthsSinceStart >= 0) {
        const scrollPosition = monthsSinceStart * TIMELINE_MONTH_WIDTH;
        container.scrollTo({ left: scrollPosition, behavior: "auto" });
        initialScrollComplete.current = true;
      }
    }
  }, [monthRange.start, today]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      if (scrollLeft < 200) {
        onLoadMore("past");
      }
      if (scrollWidth - scrollLeft - clientWidth < 200) {
        onLoadMore("future");
      }
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [onLoadMore]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        표시할 일정이 없습니다.
      </div>
    );
  }

  const timelineWidth = timeline.months.length * TIMELINE_MONTH_WIDTH;
  const timelineWidthMobile = timeline.months.length * TIMELINE_MONTH_WIDTH_MOBILE;

  const todayLinePositionDesktop = timeline.todayMarker
    ? timeline.todayMarker.monthIndex * TIMELINE_MONTH_WIDTH +
      timeline.todayMarker.dayOffsetRatio * TIMELINE_MONTH_WIDTH
    : null;

  const todayLinePositionMobile = timeline.todayMarker
    ? timeline.todayMarker.monthIndex * TIMELINE_MONTH_WIDTH_MOBILE +
      timeline.todayMarker.dayOffsetRatio * TIMELINE_MONTH_WIDTH_MOBILE
    : null;

  return (
    <div ref={containerRef}>
      {/* Desktop Month Gantt View */}
      <div
        ref={scrollContainerRef}
        className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block"
      >
        <div style={{ width: TIMELINE_LEFT_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/50 backdrop-blur-sm">
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-40 flex h-14 items-center border-r border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 shadow-sm"
                style={{ width: TIMELINE_LEFT_WIDTH }}
              >
                캠페인
              </div>
              <div className="relative h-14" style={{ width: timelineWidth }}>
                <div className="flex h-full">
                  {timeline.years.map((year) => (
                    <div
                      key={year.key}
                      className="absolute top-0 flex h-6 items-center"
                      style={{
                        left: year.startMonthIndex * TIMELINE_MONTH_WIDTH,
                        width: year.monthCount * TIMELINE_MONTH_WIDTH,
                      }}
                    >
                      <span className="pl-2 text-xs font-semibold text-slate-600">{year.year}</span>
                    </div>
                  ))}
                  {timeline.months.map((month) => (
                    <div
                      key={month.key}
                      className="flex h-full items-end justify-center border-r border-slate-100 pb-2"
                      style={{ width: TIMELINE_MONTH_WIDTH }}
                    >
                      <span className="text-sm font-semibold text-slate-700">{month.label}</span>
                    </div>
                  ))}
                </div>
                {todayLinePositionDesktop !== null ? (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-rose-500"
                      style={{ left: todayLinePositionDesktop }}
                    />
                    <div
                      className="pointer-events-none absolute -top-1.5 z-30 flex items-center"
                      style={{
                        left: todayLinePositionDesktop,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        Today
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative">
            {rows.map((row, rowIndex) => {
              const variant = getColorVariant(row.channel);
              const displayLabel = columnAccess.campaign ? row.label : "권한 없음";
              const displayChannel = columnAccess.channel ? row.channel : "권한 없음";
              const displayDepartment = columnAccess.department ? row.department : "권한 없음";
              const displayAgency = columnAccess.agency ? row.agency : "권한 없음";
              const periodLabel =
                columnAccess.schedule && row.startDate && row.endDate
                  ? `${format(row.startDate, "yyyy.MM.dd")} ~ ${format(row.endDate, "yyyy.MM.dd")}`
                  : "권한 없음";

              const canRenderBar =
                columnAccess.schedule &&
                row.barStartPx !== null &&
                row.barLengthPx !== null &&
                row.barLengthPx > 0;

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50";

              return (
                <div key={row.id} className="flex border-b border-slate-100">
                  <div
                    className={cn(
                      "sticky left-0 z-30 border-r border-slate-100 px-4 py-4",
                      rowBackgroundClass,
                    )}
                    style={{ width: TIMELINE_LEFT_WIDTH }}
                  >
                    <p className="font-semibold text-slate-900">{displayLabel}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      {displayChannel !== "권한 없음" && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {displayChannel}
                        </span>
                      )}
                      {displayDepartment !== "권한 없음" && (
                        <span className="text-slate-500">{displayDepartment}</span>
                      )}
                      {displayAgency !== "권한 없음" && (
                        <>
                          {displayDepartment !== "권한 없음" && (
                            <span className="text-slate-400">·</span>
                          )}
                          <span className="text-slate-500">{displayAgency}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn("relative", rowBackgroundClass)}
                    style={{
                      width: timelineWidth,
                      minHeight: "72px",
                    }}
                  >
                    <div className="absolute inset-y-0 left-0 flex" aria-hidden>
                      {timeline.months.map((month) => (
                        <div
                          key={month.key}
                          className="h-full border-r border-slate-100"
                          style={{ width: TIMELINE_MONTH_WIDTH }}
                        />
                      ))}
                    </div>
                    {canRenderBar ? (
                      <div
                        className={cn(
                          "absolute top-1/2 flex h-10 -translate-y-1/2 items-center justify-start rounded-lg px-3 text-xs font-semibold text-white transition-all",
                          variant.barClass,
                        )}
                        style={{
                          left: `${row.barStartPx!}px`,
                          width: `${row.barLengthPx!}px`,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="truncate">{displayLabel}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {todayLinePositionDesktop !== null ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-rose-500/50"
                style={{ left: todayLinePositionDesktop }}
              />
            ) : null}
          </div>
        </div>
      </div>
      {/* Mobile Month Gantt View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white md:hidden">
        <div style={{ width: TIMELINE_LEFT_WIDTH_MOBILE + timelineWidthMobile }}>
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/50 backdrop-blur-sm">
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-40 flex h-12 items-center border-r border-slate-200 bg-slate-50/50 px-2 text-xs font-semibold text-slate-900 shadow-sm"
                style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
              >
                캠페인
              </div>
              <div
                className="relative h-12"
                style={{
                  width: timelineWidthMobile,
                }}
              >
                <div className="flex h-full">
                  {timeline.years.map((year) => (
                    <div
                      key={year.key}
                      className="absolute top-0 flex h-5 items-center"
                      style={{
                        left: year.startMonthIndex * TIMELINE_MONTH_WIDTH_MOBILE,
                        width: year.monthCount * TIMELINE_MONTH_WIDTH_MOBILE,
                      }}
                    >
                      <span className="pl-1 text-[10px] font-medium text-slate-500">
                        {year.year}
                      </span>
                    </div>
                  ))}
                  {timeline.months.map((month) => (
                    <div
                      key={month.key}
                      className="flex h-full items-end justify-center border-r border-slate-100 pb-1.5"
                      style={{ width: TIMELINE_MONTH_WIDTH_MOBILE }}
                    >
                      <span className="text-[11px] font-semibold text-slate-700">
                        {month.label}
                      </span>
                    </div>
                  ))}
                </div>
                {todayLinePositionMobile !== null ? (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-rose-500"
                      style={{ left: todayLinePositionMobile }}
                    />
                    <div
                      className="pointer-events-none absolute -top-1 z-30 flex items-center"
                      style={{
                        left: todayLinePositionMobile,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
                        Today
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            {rows.map((row, rowIndex) => {
              const variant = getColorVariant(row.channel);
              const displayLabel = columnAccess.campaign ? row.label : "권한 없음";
              const displayChannel = columnAccess.channel ? row.channel : "권한 없음";
              const periodLabel =
                columnAccess.schedule && row.startDate && row.endDate
                  ? `${format(row.startDate, "MM.dd")} ~ ${format(row.endDate, "MM.dd")}`
                  : "권한 없음";

              const mobileBarStartPx =
                row.barStartPx !== null
                  ? (row.barStartPx / TIMELINE_MONTH_WIDTH) * TIMELINE_MONTH_WIDTH_MOBILE
                  : null;
              const mobileBarLengthPx =
                row.barLengthPx !== null
                  ? (row.barLengthPx / TIMELINE_MONTH_WIDTH) * TIMELINE_MONTH_WIDTH_MOBILE
                  : null;

              const canRenderBar =
                columnAccess.schedule && mobileBarStartPx !== null && mobileBarLengthPx !== null;

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50";

              return (
                <div key={row.id} className="flex border-b border-slate-100">
                  <div
                    className={cn(
                      "sticky left-0 z-20 border-r border-slate-100 bg-white px-2 py-3",
                      rowBackgroundClass,
                    )}
                    style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
                  >
                    <p className="font-semibold text-slate-900 line-clamp-2 text-xs">
                      {displayLabel}
                    </p>
                    {displayChannel !== "권한 없음" && (
                      <span className="mt-1.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {displayChannel}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn("relative", rowBackgroundClass)}
                    style={{
                      width: timelineWidthMobile,
                      minHeight: "60px",
                    }}
                  >
                    <div className="absolute inset-y-0 left-0 flex" aria-hidden>
                      {timeline.months.map((month) => (
                        <div
                          key={month.key}
                          className="h-full border-r border-slate-100"
                          style={{ width: TIMELINE_MONTH_WIDTH_MOBILE }}
                        />
                      ))}
                    </div>
                    {canRenderBar ? (
                      <div
                        className={cn(
                          "absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-start rounded-md pl-1.5 text-[10px] font-semibold text-white transition-all",
                          variant.barClass,
                        )}
                        style={{
                          left: `${mobileBarStartPx}px`,
                          width: `${mobileBarLengthPx}px`,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="truncate">{displayLabel}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
             {todayLinePositionMobile !== null ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-rose-500/50"
                style={{ left: todayLinePositionMobile }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ScheduleCalendarProps extends CalendarData {
  columnAccess: ScheduleColumnAccess;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const ScheduleCalendar = ({ days, month, schedulesByDay, columnAccess }: ScheduleCalendarProps) => {
  return (
    <div className="space-y-4">
      <div className="hidden grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500 lg:grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-7 lg:gap-2">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const schedules = schedulesByDay[key];
          const isCurrentMonth = day.getMonth() === month.getMonth();

          return (
            <div
              key={key}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-2 text-left text-xs",
                "min-h-[100px] lg:min-h-[130px]",
                isCurrentMonth
                  ? "border-slate-200 bg-white"
                  : "hidden border-slate-100 bg-slate-50 text-slate-400 lg:flex",
              )}
            >
              <header className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <span className={cn(!isCurrentMonth && "text-slate-400", "lg:hidden")}>
                    {format(day, "M월 d일")} ({WEEKDAY_LABELS[day.getDay()]})
                  </span>
                  <span className={cn(!isCurrentMonth && "text-slate-400", "hidden lg:inline")}>
                    {format(day, "d")}
                  </span>
                </div>
                {schedules?.length ? (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {schedules.length}
                  </span>
                ) : null}
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {schedules && schedules.length > 0 ? (
                  schedules.map((schedule) => {
                    const variant = getColorVariant(schedule.channel);
                    const displayLabel = columnAccess.campaign ? schedule.campaign : "권한 없음";
                    const displayChannel = columnAccess.channel ? schedule.channel : "권한 없음";
                    const displayAgency = columnAccess.agency ? schedule.agency : "권한 없음";
                    const periodLabel =
                      columnAccess.schedule && schedule.startDate && schedule.endDate
                        ? `${format(parseISO(schedule.startDate), "MM.dd")} - ${format(
                            parseISO(schedule.endDate),
                            "MM.dd",
                          )}`
                        : "권한 없음";

                    return (
                      <article
                        key={`${schedule.id}-${key}`}
                        className={cn(
                          "rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 shadow-sm transition hover:bg-slate-100",
                          "border-l-4",
                          variant.accentClass,
                        )}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <p className="font-semibold text-slate-700">{displayLabel}</p>
                        <p>
                          {displayChannel} · {displayAgency}
                        </p>
                        <p className="text-[10px] text-slate-500">{periodLabel}</p>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-slate-400">일정 없음</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
