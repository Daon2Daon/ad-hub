"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [selectedChannel, setSelectedChannel] = useState<string>(ALL_OPTION);
  const [selectedAgency, setSelectedAgency] = useState<string>(ALL_OPTION);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

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

  const ganttData = useMemo(
    () => buildGanttData(filteredItems, currentMonth),
    [filteredItems, currentMonth],
  );
  const monthGanttData = useMemo(
    () => buildMonthGanttData(filteredItems, currentMonth),
    [filteredItems, currentMonth],
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
    setCurrentMonth((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const handleResetMonth = () => {
    setCurrentMonth(startOfMonth(new Date()));
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
      return <ScheduleGanttMonth {...monthGanttData} columnAccess={columnAccess} />;
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

interface TimelineDayCell {
  key: string;
  year: number;
  month: number;
  day: number;
  weekday: number;
  label: number;
  isWeekend: boolean;
  isToday: boolean;
}

interface TimelineMonthBlock {
  key: string;
  label: string;
  length: number;
}

interface TimelineContext {
  totalDays: number;
  days: TimelineDayCell[];
  months: TimelineMonthBlock[];
  todayOffset: number | null;
  rangeLabel: { start: string; end: string };
  dayIndexMap: Record<string, number>;
}

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
  todayMonthIndex: number | null;
}

interface GanttRow {
  id: string;
  label: string;
  channel: string;
  department: string;
  agency: string;
  startDate: Date | null;
  endDate: Date | null;
  barStart: number | null;
  barLength: number | null;
}

interface GanttData {
  rows: GanttRow[];
  timeline: TimelineContext;
}

function toDayDescriptor(date: Date) {
  const formatted = DATE_KEY_FORMATTER.format(date);
  const [yearStr, monthStr, dayStr] = formatted.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const weekday = new Date(utcMidnight).getUTCDay();
  return { key: formatted, year, month, day, weekday };
}

function buildMonthTimelineContext(centerMonth: Date): MonthTimelineContext {
  const months: MonthTimelineContext["months"] = [];
  const monthIndexMap: Record<string, number> = {};
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  let todayMonthIndex: number | null = null;

  // 현재 달 기준으로 앞뒤 달 계산
  const startMonth = subMonths(centerMonth, Math.floor(MONTHS_TO_SHOW / 2));
  const endMonth = addMonths(centerMonth, Math.floor(MONTHS_TO_SHOW / 2));

  let currentDate = startOfMonth(startMonth);
  const endDate = endOfMonth(endMonth);
  let index = 0;

  while (currentDate <= endDate) {
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

    if (year === todayYear && month === todayMonth) {
      todayMonthIndex = index;
    }

    currentDate = addMonths(currentDate, 1);
    index++;
  }

  // 연도 그룹화
  const years: MonthTimelineContext["years"] = [];
  let currentYear: number | null = null;
  let yearStartIndex = 0;
  let yearMonthCount = 0;

  months.forEach((month, index) => {
    if (currentYear !== month.year) {
      if (currentYear !== null) {
        years.push({
          key: String(currentYear),
          year: currentYear,
          startMonthIndex: yearStartIndex,
          monthCount: yearMonthCount,
        });
      }
      currentYear = month.year;
      yearStartIndex = index;
      yearMonthCount = 1;
    } else {
      yearMonthCount++;
    }
  });

  if (currentYear !== null) {
    years.push({
      key: String(currentYear),
      year: currentYear,
      startMonthIndex: yearStartIndex,
      monthCount: yearMonthCount,
    });
  }

  return {
    months,
    years,
    monthIndexMap,
    todayMonthIndex,
  };
}

function buildTimelineContext(month: Date): TimelineContext {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const descriptors = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) =>
    toDayDescriptor(day),
  );
  const todayDescriptor = toDayDescriptor(new Date());
  const todayKey = todayDescriptor.key;

  const days: TimelineDayCell[] = descriptors.map((descriptor) => ({
    key: descriptor.key,
    year: descriptor.year,
    month: descriptor.month,
    day: descriptor.day,
    weekday: descriptor.weekday,
    label: descriptor.day,
    isWeekend: descriptor.weekday === 0 || descriptor.weekday === 6,
    isToday: descriptor.key === todayKey,
  }));

  const dayIndexMap = days.reduce<Record<string, number>>((acc, day, index) => {
    acc[day.key] = index;
    return acc;
  }, {});

  const months: TimelineMonthBlock[] = [];
  let currentMonthKey = "";
  let currentMonthLabel = "";
  let currentMonthLength = 0;

  days.forEach((day) => {
    const monthKey = `${day.year}-${String(day.month).padStart(2, "0")}`;
    const monthLabel = `${day.year}년 ${day.month}월`;

    if (monthLabel !== currentMonthLabel) {
      if (currentMonthLabel) {
        months.push({ key: currentMonthKey, label: currentMonthLabel, length: currentMonthLength });
      }
      currentMonthKey = monthKey;
      currentMonthLabel = monthLabel;
      currentMonthLength = 1;
    } else {
      currentMonthLength += 1;
    }
  });

  if (currentMonthLabel) {
    months.push({ key: currentMonthKey, label: currentMonthLabel, length: currentMonthLength });
  }

  const todayOffset = todayKey in dayIndexMap ? dayIndexMap[todayKey] : null;

  const rangeLabel =
    days.length > 0
      ? {
          start: `${days[0].year}.${String(days[0].month).padStart(2, "0")}.${String(days[0].day).padStart(2, "0")}`,
          end: `${days[days.length - 1].year}.${String(days[days.length - 1].month).padStart(2, "0")}.${String(
            days[days.length - 1].day,
          ).padStart(2, "0")}`,
        }
      : { start: "", end: "" };

  return {
    totalDays: days.length,
    days,
    months,
    todayOffset: todayOffset !== null && todayOffset >= 0 ? todayOffset : null,
    rangeLabel,
    dayIndexMap,
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
    barStartMonthIndex: number | null;
    barEndMonthIndex: number | null;
  }>;
  timeline: MonthTimelineContext;
}

function buildMonthGanttData(records: ScheduleRecord[], centerMonth: Date): MonthGanttData {
  const timeline = buildMonthTimelineContext(centerMonth);

  if (timeline.months.length === 0) {
    return { rows: [], timeline };
  }

  const firstMonth = timeline.months[0];
  const lastMonth = timeline.months[timeline.months.length - 1];
  const rangeStart = firstMonth.startDate;
  const rangeEnd = lastMonth.endDate;

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

      // 시작 월과 종료 월 찾기
      const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      const endMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;

      const startMonthIndex = timeline.monthIndexMap[startMonthKey];
      const endMonthIndex = timeline.monthIndexMap[endMonthKey];

      if (startMonthIndex !== undefined && endMonthIndex !== undefined) {
        const startMonth = timeline.months[startMonthIndex];
        const endMonth = timeline.months[endMonthIndex];

        // 시작 월 내에서의 위치 계산 (일 기준)
        // 예: 11월 15일이면 11월의 (15-1)/30 = 46.7% 지점
        const startMonthDays = endOfMonth(startMonth.startDate).getDate();
        const startDay = startDate.getDate();
        const startOffsetRatio = Math.max(0, Math.min(1, (startDay - 1) / startMonthDays)); // 0~1 사이의 비율

        // 종료 월 내에서의 위치 계산
        // 예: 12월 5일이면 12월의 5/31 = 16.1% 지점
        const endMonthDays = endOfMonth(endMonth.startDate).getDate();
        const endDay = endDate.getDate();
        const endOffsetRatio = Math.max(0, Math.min(1, endDay / endMonthDays)); // 0~1 사이의 비율

        // 픽셀 단위로 계산
        const startPx = startMonthIndex * TIMELINE_MONTH_WIDTH + startOffsetRatio * TIMELINE_MONTH_WIDTH;
        const endPx = endMonthIndex * TIMELINE_MONTH_WIDTH + endOffsetRatio * TIMELINE_MONTH_WIDTH;

        barStartPx = startPx;
        barLengthPx = Math.max(endPx - startPx, TIMELINE_MONTH_WIDTH * 0.1); // 최소 너비 보장
      }

      return {
        id: record.id,
        label: record.campaign,
        channel: record.channel,
        department: record.department,
        agency: record.agency,
        startDate: record.startDate ? new Date(record.startDate) : null,
        endDate: record.endDate ? new Date(record.endDate) : null,
        barStartPx,
        barLengthPx,
        barStartMonthIndex: startMonthIndex ?? null,
        barEndMonthIndex: endMonthIndex ?? null,
      };
    });

  return { rows, timeline };
}

function buildGanttData(records: ScheduleRecord[], month: Date): GanttData {
  const timeline = buildTimelineContext(month);

  const firstKey = timeline.days[0]?.key;
  const lastKey = timeline.days[timeline.days.length - 1]?.key;

  const normalized = records
    .map((record) => {
      if (!record.startDate || !record.endDate) {
        return null;
      }

      const startDate = parseISO(record.startDate);
      const endDate = parseISO(record.endDate);
      const startDescriptor = toDayDescriptor(startDate);
      const endDescriptor = toDayDescriptor(endDate);

      return {
        record,
        startDate,
        endDate,
        startDescriptor,
        endDescriptor,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .filter(({ startDescriptor, endDescriptor }) => {
      if (!firstKey || !lastKey) {
        return false;
      }
      return endDescriptor.key >= firstKey && startDescriptor.key <= lastKey;
    });

  const rows: GanttRow[] = normalized
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
    .map(({ record, startDate, endDate, startDescriptor, endDescriptor }) => {
      let barStart: number | null = null;
      let barLength: number | null = null;

      if (firstKey && lastKey) {
        const clampedStartKey = startDescriptor.key < firstKey ? firstKey : startDescriptor.key;
        const clampedEndKey = endDescriptor.key > lastKey ? lastKey : endDescriptor.key;

        const startIndex = timeline.dayIndexMap[clampedStartKey];
        const endIndex = timeline.dayIndexMap[clampedEndKey];

        if (startIndex !== undefined && endIndex !== undefined) {
          barStart = startIndex;
          barLength = endIndex - startIndex + 1;
        }
      }

      return {
        id: record.id,
        label: record.campaign,
        channel: record.channel,
        department: record.department,
        agency: record.agency,
        startDate: record.startDate ? new Date(record.startDate) : null,
        endDate: record.endDate ? new Date(record.endDate) : null,
        barStart,
        barLength,
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

interface ScheduleGanttProps extends GanttData {
  columnAccess: ScheduleColumnAccess;
}

interface ScheduleGanttMonthProps extends MonthGanttData {
  columnAccess: ScheduleColumnAccess;
}

const TIMELINE_LEFT_WIDTH = 220;
const TIMELINE_LEFT_WIDTH_MOBILE = 160;
const TIMELINE_DAY_WIDTH = 38;
const TIMELINE_DAY_WIDTH_MOBILE = 32;
const TIMELINE_MONTH_WIDTH = 120;
const TIMELINE_MONTH_WIDTH_MOBILE = 80;
const MONTHS_TO_SHOW = 6; // 현재 달 기준 앞뒤로 표시할 달 수

const ScheduleGantt = ({ rows, timeline, columnAccess }: ScheduleGanttProps) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        {timeline.rangeLabel.start || timeline.rangeLabel.end
          ? `${timeline.rangeLabel.start} ~ ${timeline.rangeLabel.end}에 표시할 일정이 없습니다.`
          : "표시할 일정이 없습니다."}
      </div>
    );
  }

  const timelineWidth = Math.max(timeline.totalDays * TIMELINE_DAY_WIDTH, 1);
  const timelineWidthMobile = Math.max(timeline.totalDays * TIMELINE_DAY_WIDTH_MOBILE, 1);
  const todayColumnIndex = timeline.todayOffset;

  return (
    <div className="space-y-4">
      {/* Desktop Gantt View */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-30 flex h-12 items-center border-r border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                style={{ width: TIMELINE_LEFT_WIDTH }}
              >
                캠페인 / 매체/구분
              </div>
              <div className="relative h-12" style={{ width: timelineWidth }}>
                <div className="flex h-full">
                  {timeline.months.map((month) => (
                    <div
                      key={month.key}
                      className="flex h-full items-center justify-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-700"
                      style={{ width: month.length * TIMELINE_DAY_WIDTH }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex">
              <div
                className="sticky left-0 z-30 flex h-10 items-center border-r border-slate-200 bg-white px-4 text-xs font-medium uppercase tracking-wide text-slate-400"
                style={{ width: TIMELINE_LEFT_WIDTH }}
              >
                일자
              </div>
              <div className="relative h-10" style={{ width: timelineWidth }}>
                <div className="flex h-full" aria-hidden>
                  {timeline.days.map((day, index) => (
                    <div
                      key={day.key}
                      className={cn(
                        "flex h-full items-center justify-center border-r border-slate-200 text-xs font-semibold text-slate-500",
                        index === 0 && "border-l border-slate-200",
                        day.isWeekend && "bg-slate-50 text-slate-400",
                        day.isToday && "text-rose-600",
                      )}
                      style={{ width: TIMELINE_DAY_WIDTH }}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
                {todayColumnIndex !== null ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-1 z-10 rounded-md bg-amber-100/80"
                    style={{
                      left: todayColumnIndex * TIMELINE_DAY_WIDTH,
                      width: TIMELINE_DAY_WIDTH,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div>
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
                row.barStart !== null &&
                row.barLength !== null &&
                row.barLength > 0;

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50";

              return (
                <div key={row.id} className="flex border-b border-slate-200">
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-200 px-4 py-3 text-sm text-slate-700",
                      rowBackgroundClass,
                    )}
                    style={{ width: TIMELINE_LEFT_WIDTH }}
                  >
                    <p className="font-semibold text-slate-900">{displayLabel}</p>
                    <p className="text-xs text-slate-500">
                      {displayChannel} · {displayDepartment} · {displayAgency}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{periodLabel}</p>
                  </div>
                  <div
                    className={cn("relative", rowBackgroundClass)}
                    style={{ width: timelineWidth }}
                  >
                    <div className="flex h-full" aria-hidden>
                      {timeline.days.map((day, index) => (
                        <div
                          key={`${row.id}-grid-${day.key}`}
                          className={cn(
                            "border-r border-slate-100",
                            index === 0 && "border-l border-slate-100",
                            day.isWeekend && "bg-slate-50/80",
                          )}
                          style={{ width: TIMELINE_DAY_WIDTH }}
                        />
                      ))}
                    </div>
                    {todayColumnIndex !== null ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-20 rounded-md bg-amber-100/60"
                        style={{
                          left: todayColumnIndex * TIMELINE_DAY_WIDTH,
                          width: TIMELINE_DAY_WIDTH,
                        }}
                      />
                    ) : null}
                    {canRenderBar ? (
                      <div
                        className={cn(
                          "absolute top-2 flex h-9 items-center justify-center rounded-md text-xs font-semibold text-white shadow-sm transition",
                          variant.barClass,
                        )}
                        style={{
                          left: row.barStart! * TIMELINE_DAY_WIDTH + 2,
                          width: Math.max(
                            row.barLength! * TIMELINE_DAY_WIDTH - 4,
                            TIMELINE_DAY_WIDTH / 2,
                          ),
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="sr-only">
                          {displayLabel} 일정 {periodLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                        일정 정보 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Gantt View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 md:hidden">
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH_MOBILE + timelineWidthMobile }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-30 flex h-10 items-center border-r border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
              >
                캠페인
              </div>
              <div className="relative h-10" style={{ width: timelineWidthMobile }}>
                <div className="flex h-full">
                  {timeline.months.map((month) => (
                    <div
                      key={month.key}
                      className="flex h-full items-center justify-center border-r border-slate-200 px-1 text-[10px] font-semibold text-slate-700"
                      style={{ width: month.length * TIMELINE_DAY_WIDTH_MOBILE }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex">
              <div
                className="sticky left-0 z-30 flex h-8 items-center border-r border-slate-200 bg-white px-2 text-[10px] font-medium uppercase tracking-wide text-slate-400"
                style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
              >
                일자
              </div>
              <div className="relative h-8" style={{ width: timelineWidthMobile }}>
                <div className="flex h-full" aria-hidden>
                  {timeline.days.map((day, index) => (
                    <div
                      key={day.key}
                      className={cn(
                        "flex h-full items-center justify-center border-r border-slate-200 text-[10px] font-semibold text-slate-500",
                        index === 0 && "border-l border-slate-200",
                        day.isWeekend && "bg-slate-50 text-slate-400",
                        day.isToday && "text-rose-600",
                      )}
                      style={{ width: TIMELINE_DAY_WIDTH_MOBILE }}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
                {todayColumnIndex !== null ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0.5 z-10 rounded bg-amber-100/80"
                    style={{
                      left: todayColumnIndex * TIMELINE_DAY_WIDTH_MOBILE,
                      width: TIMELINE_DAY_WIDTH_MOBILE,
                    }}
                  />
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

              const canRenderBar =
                columnAccess.schedule &&
                row.barStart !== null &&
                row.barLength !== null &&
                row.barLength > 0;

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50";

              return (
                <div key={row.id} className="flex border-b border-slate-200">
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-200 px-2 py-2 text-xs text-slate-700",
                      rowBackgroundClass,
                    )}
                    style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
                  >
                    <p className="font-semibold text-slate-900 line-clamp-2">{displayLabel}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">
                      {displayChannel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{periodLabel}</p>
                  </div>
                  <div
                    className={cn("relative", rowBackgroundClass)}
                    style={{ width: timelineWidthMobile }}
                  >
                    <div className="flex h-full" aria-hidden>
                      {timeline.days.map((day, index) => (
                        <div
                          key={`${row.id}-grid-${day.key}`}
                          className={cn(
                            "border-r border-slate-100",
                            index === 0 && "border-l border-slate-100",
                            day.isWeekend && "bg-slate-50/80",
                          )}
                          style={{ width: TIMELINE_DAY_WIDTH_MOBILE }}
                        />
                      ))}
                    </div>
                    {todayColumnIndex !== null ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-20 rounded bg-amber-100/60"
                        style={{
                          left: todayColumnIndex * TIMELINE_DAY_WIDTH_MOBILE,
                          width: TIMELINE_DAY_WIDTH_MOBILE,
                        }}
                      />
                    ) : null}
                    {canRenderBar ? (
                      <div
                        className={cn(
                          "absolute top-1 flex h-6 items-center justify-center rounded text-[10px] font-semibold text-white shadow-sm transition",
                          variant.barClass,
                        )}
                        style={{
                          left: row.barStart! * TIMELINE_DAY_WIDTH_MOBILE + 1,
                          width: Math.max(
                            row.barLength! * TIMELINE_DAY_WIDTH_MOBILE - 2,
                            TIMELINE_DAY_WIDTH_MOBILE / 2,
                          ),
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="sr-only">
                          {displayLabel} 일정 {periodLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">
                        일정 정보 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ScheduleGanttMonth = ({ rows, timeline, columnAccess }: ScheduleGanttMonthProps) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        표시할 일정이 없습니다.
      </div>
    );
  }

  const timelineWidth = timeline.months.length * TIMELINE_MONTH_WIDTH;
  const timelineWidthMobile = timeline.months.length * TIMELINE_MONTH_WIDTH_MOBILE;
  const todayMonthIndex = timeline.todayMonthIndex;
  
  // Today 라인 위치 계산 (헤더용 - TIMELINE_LEFT_WIDTH 포함)
  const todayLinePositionDesktop = todayMonthIndex !== null
    ? todayMonthIndex * TIMELINE_MONTH_WIDTH + TIMELINE_MONTH_WIDTH / 2 + TIMELINE_LEFT_WIDTH
    : null;
  const todayLinePositionMobile = todayMonthIndex !== null
    ? todayMonthIndex * TIMELINE_MONTH_WIDTH_MOBILE + TIMELINE_MONTH_WIDTH_MOBILE / 2 + TIMELINE_LEFT_WIDTH_MOBILE
    : null;

  return (
    <div className="space-y-4">
      {/* Desktop Month Gantt View */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/50">
            {/* Month Row with Year Integration */}
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-40 flex h-14 items-center border-r border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.05)]"
                style={{ width: TIMELINE_LEFT_WIDTH }}
              >
                캠페인
              </div>
              <div
                className="relative h-14 overflow-hidden"
                style={{
                  width: timelineWidth,
                  clipPath: `inset(0 0 0 ${TIMELINE_LEFT_WIDTH}px)`,
                  marginLeft: `-${TIMELINE_LEFT_WIDTH}px`,
                }}
              >
                <div className="flex h-full" style={{ marginLeft: `${TIMELINE_LEFT_WIDTH}px` }}>
                  {timeline.months.map((month, index) => {
                    const yearInfo = timeline.years.find(
                      (y) => y.startMonthIndex <= index && index < y.startMonthIndex + y.monthCount,
                    );
                    const isFirstMonthOfYear = yearInfo?.startMonthIndex === index;
                    return (
                      <div
                        key={month.key}
                        className="relative z-25 flex h-full flex-col items-center justify-center border-r border-slate-100 px-2 bg-slate-50/50"
                        style={{ width: TIMELINE_MONTH_WIDTH }}
                      >
                        {isFirstMonthOfYear && yearInfo ? (
                          <span className="text-[10px] font-medium text-slate-500 leading-none">
                            {yearInfo.year}
                          </span>
                        ) : (
                          <span className="text-[10px] leading-none" />
                        )}
                        <span className="mt-0.5 text-sm font-semibold text-slate-700">
                          {month.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {todayLinePositionDesktop !== null ? (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-rose-500"
                      style={{ left: todayLinePositionDesktop }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 z-30 flex items-center"
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

          <div>
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

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50";

              return (
                <div key={row.id} className="flex border-b border-slate-100">
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-4 shadow-[4px_0_10px_rgba(0,0,0,0.05)]",
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
                    className={cn("relative overflow-hidden bg-white", rowBackgroundClass)}
                    style={{
                      width: timelineWidth,
                      minHeight: "72px",
                      clipPath: `inset(0 0 0 ${TIMELINE_LEFT_WIDTH}px)`,
                      marginLeft: `-${TIMELINE_LEFT_WIDTH}px`,
                    }}
                  >
                    {/* Today 라인은 헤더에만 표시되므로 데이터 행에서는 제거 */}
                    {canRenderBar ? (
                      <div
                        className={cn(
                          "absolute top-1/2 flex h-10 -translate-y-1/2 items-center justify-center rounded-lg text-xs font-semibold text-white transition-all",
                          variant.barClass,
                        )}
                        style={{
                          left: `${row.barStartPx!}px`,
                          width: `${Math.max(row.barLengthPx!, TIMELINE_MONTH_WIDTH * 0.1)}px`,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="sr-only">
                          {displayLabel} 일정 {periodLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                        일정 정보 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Month Gantt View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white md:hidden">
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH_MOBILE + timelineWidthMobile }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/50">
            {/* Month Row with Year Integration */}
            <div className="flex border-b border-slate-200">
              <div
                className="sticky left-0 z-40 flex h-12 items-center border-r border-slate-200 bg-slate-50/50 px-2 text-xs font-semibold text-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.05)]"
                style={{ width: TIMELINE_LEFT_WIDTH_MOBILE }}
              >
                캠페인
              </div>
              <div
                className="relative h-12 overflow-hidden"
                style={{
                  width: timelineWidthMobile,
                  clipPath: `inset(0 0 0 ${TIMELINE_LEFT_WIDTH_MOBILE}px)`,
                  marginLeft: `-${TIMELINE_LEFT_WIDTH_MOBILE}px`,
                }}
              >
                <div className="flex h-full" style={{ marginLeft: `${TIMELINE_LEFT_WIDTH_MOBILE}px` }}>
                  {timeline.months.map((month, index) => {
                    const yearInfo = timeline.years.find(
                      (y) => y.startMonthIndex <= index && index < y.startMonthIndex + y.monthCount,
                    );
                    const isFirstMonthOfYear = yearInfo?.startMonthIndex === index;
                    return (
                      <div
                        key={month.key}
                        className="relative z-25 flex h-full flex-col items-center justify-center border-r border-slate-100 px-1 bg-slate-50/50"
                        style={{ width: TIMELINE_MONTH_WIDTH_MOBILE }}
                      >
                        {isFirstMonthOfYear && yearInfo ? (
                          <span className="text-[9px] font-medium text-slate-500 leading-none">
                            {yearInfo.year}
                          </span>
                        ) : (
                          <span className="text-[9px] leading-none" />
                        )}
                        <span className="mt-0.5 text-[10px] font-semibold text-slate-700">
                          {month.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                  {todayLinePositionMobile !== null ? (
                    <>
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-rose-500"
                        style={{ left: todayLinePositionMobile }}
                      />
                      <div
                        className="pointer-events-none absolute top-0 z-30 flex items-center"
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

              const canRenderBar =
                columnAccess.schedule &&
                row.barStartPx !== null &&
                row.barLengthPx !== null &&
                row.barLengthPx > 0;

              const rowBackgroundClass = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50";

              // 모바일용 픽셀 계산 (비율 유지)
              const mobileBarStartPx = row.barStartPx !== null 
                ? (row.barStartPx / TIMELINE_MONTH_WIDTH) * TIMELINE_MONTH_WIDTH_MOBILE
                : null;
              const mobileBarLengthPx = row.barLengthPx !== null
                ? (row.barLengthPx / TIMELINE_MONTH_WIDTH) * TIMELINE_MONTH_WIDTH_MOBILE
                : null;

              return (
                <div key={row.id} className="flex border-b border-slate-100">
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-3 shadow-[4px_0_10px_rgba(0,0,0,0.05)]",
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
                    className={cn("relative overflow-hidden bg-white", rowBackgroundClass)}
                    style={{
                      width: timelineWidthMobile,
                      minHeight: "60px",
                      clipPath: `inset(0 0 0 ${TIMELINE_LEFT_WIDTH_MOBILE}px)`,
                      marginLeft: `-${TIMELINE_LEFT_WIDTH_MOBILE}px`,
                    }}
                  >
                    {/* Today 라인은 헤더에만 표시되므로 데이터 행에서는 제거 */}
                    {canRenderBar && mobileBarStartPx !== null && mobileBarLengthPx !== null ? (
                      <div
                        className={cn(
                          "absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-center rounded-lg text-[10px] font-semibold text-white transition-all",
                          variant.barClass,
                        )}
                        style={{
                          left: `${mobileBarStartPx}px`,
                          width: `${Math.max(mobileBarLengthPx, TIMELINE_MONTH_WIDTH_MOBILE * 0.1)}px`,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                        title={`${displayLabel} | ${periodLabel}`}
                      >
                        <span className="sr-only">
                          {displayLabel} 일정 {periodLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">
                        일정 정보 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
