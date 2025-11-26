"use client";

import { useCallback, useEffect, useRef } from "react";
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

import { cn } from "@/lib/utils";
import type { ScheduleColumnAccess, ScheduleRecord } from "@/types/schedule";

const COLOR_VARIANTS = [
  { barClass: "bg-indigo-500/90", accentClass: "border-l-indigo-500", badgeClass: "bg-indigo-500" },
  { barClass: "bg-emerald-500/90", accentClass: "border-l-emerald-500", badgeClass: "bg-emerald-500" },
  { barClass: "bg-rose-500/90", accentClass: "border-l-rose-500", badgeClass: "bg-rose-500" },
  { barClass: "bg-amber-500/90", accentClass: "border-l-amber-500", badgeClass: "bg-amber-500" },
  { barClass: "bg-violet-500/90", accentClass: "border-l-violet-500", badgeClass: "bg-violet-500" },
  { barClass: "bg-cyan-500/90", accentClass: "border-l-cyan-500", badgeClass: "bg-cyan-500" },
] as const;

type ColorVariant = (typeof COLOR_VARIANTS)[number];

function hashString(value: string) {
  return Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getColorVariant(seed: string): ColorVariant {
  const normalized = seed || "default";
  const index = Math.abs(hashString(normalized)) % COLOR_VARIANTS.length;
  return COLOR_VARIANTS[index];
}

export type ScrollAlign = "start" | "center";

export interface ExtendTimelinePayload {
  direction: "backward" | "forward";
  months: number;
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

function buildMonthTimelineContext(windowStart: Date, monthCount: number): MonthTimelineContext {
  const months: MonthTimelineContext["months"] = [];
  const monthIndexMap: Record<string, number> = {};
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  let todayMonthIndex: number | null = null;

  const normalizedStart = startOfMonth(windowStart);

  for (let index = 0; index < monthCount; index += 1) {
    const currentDate = addMonths(normalizedStart, index);
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
  }

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
      yearMonthCount += 1;
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

export function buildMonthGanttData(
  records: ScheduleRecord[],
  windowStart: Date,
  monthCount: number,
): MonthGanttData {
  const timeline = buildMonthTimelineContext(windowStart, monthCount);

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

interface CalendarData {
  days: Date[];
  month: Date;
  schedulesByDay: Record<string, ScheduleRecord[]>;
}

export function buildCalendarData(records: ScheduleRecord[], month: Date): CalendarData {
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
  onExtendTimeline?: (payload: ExtendTimelinePayload) => number;
  scrollTargetKey?: string | null;
  scrollAlign?: ScrollAlign;
  scrollSignal?: number;
}

const TIMELINE_LEFT_WIDTH = 220;
const TIMELINE_LEFT_WIDTH_MOBILE = 160;
const TIMELINE_MONTH_WIDTH = 120;
const TIMELINE_MONTH_WIDTH_MOBILE = 80;
const INITIAL_MONTH_WINDOW = 8;
const INITIAL_PAST_BUFFER_MONTHS = 4;
export const MONTH_WINDOW_CHUNK = 4;
export const MAX_MONTH_WINDOW = 48;

export function buildInitialMonthWindow(baseMonth: Date) {
  return {
    start: startOfMonth(subMonths(baseMonth, INITIAL_PAST_BUFFER_MONTHS + 1)),
    count: Math.min(MAX_MONTH_WINDOW, INITIAL_MONTH_WINDOW + INITIAL_PAST_BUFFER_MONTHS),
  };
}

export const ScheduleGanttMonth = ({
  rows,
  timeline,
  columnAccess,
  onExtendTimeline,
  scrollTargetKey = null,
  scrollAlign = "start",
  scrollSignal = 0,
}: ScheduleGanttMonthProps) => {
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingBackwardMonthsRef = useRef(0);
  const awaitingExtensionRef = useRef(false);
  const desktopInteractionRef = useRef(false);
  const mobileInteractionRef = useRef(false);
  const scrollTargetIndex =
    scrollTargetKey && scrollTargetKey in timeline.monthIndexMap
      ? timeline.monthIndexMap[scrollTargetKey]
      : undefined;

  const requestExtension = useCallback(
    (direction: ExtendTimelinePayload["direction"]) => {
      if (!onExtendTimeline || awaitingExtensionRef.current) {
        return;
      }
      const monthsAdded = onExtendTimeline({ direction, months: MONTH_WINDOW_CHUNK });
      if (monthsAdded > 0) {
        awaitingExtensionRef.current = true;
        if (direction === "backward") {
          pendingBackwardMonthsRef.current += monthsAdded;
        }
      }
    },
    [onExtendTimeline],
  );

  useEffect(() => {
    if (!onExtendTimeline) {
      return;
    }

    const node = desktopScrollRef.current;
    if (!node) {
      return;
    }

    const threshold = TIMELINE_MONTH_WIDTH * 1.5;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const { scrollLeft, clientWidth, scrollWidth } = node;
        if (scrollLeft > 0) {
          desktopInteractionRef.current = true;
        }
        if (desktopInteractionRef.current && scrollLeft <= threshold) {
          requestExtension("backward");
        } else if (scrollLeft + clientWidth >= scrollWidth - threshold) {
          requestExtension("forward");
        }
      });
    };

    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [onExtendTimeline, requestExtension]);

  useEffect(() => {
    if (!onExtendTimeline) {
      return;
    }

    const node = mobileScrollRef.current;
    if (!node) {
      return;
    }

    const threshold = TIMELINE_MONTH_WIDTH_MOBILE * 1.5;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const { scrollLeft, clientWidth, scrollWidth } = node;
        if (scrollLeft > 0) {
          mobileInteractionRef.current = true;
        }
        if (mobileInteractionRef.current && scrollLeft <= threshold) {
          requestExtension("backward");
        } else if (scrollLeft + clientWidth >= scrollWidth - threshold) {
          requestExtension("forward");
        }
      });
    };

    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [onExtendTimeline, requestExtension]);

  useEffect(() => {
    if (!awaitingExtensionRef.current && pendingBackwardMonthsRef.current === 0) {
      return;
    }
    awaitingExtensionRef.current = false;

    const backwardMonths = pendingBackwardMonthsRef.current;
    if (backwardMonths > 0) {
      if (desktopScrollRef.current) {
        desktopScrollRef.current.scrollLeft += backwardMonths * TIMELINE_MONTH_WIDTH;
      }
      if (mobileScrollRef.current) {
        mobileScrollRef.current.scrollLeft += backwardMonths * TIMELINE_MONTH_WIDTH_MOBILE;
      }
      pendingBackwardMonthsRef.current = 0;
    }
  }, [timeline.months.length]);

  useEffect(() => {
    if (!onExtendTimeline) {
      return;
    }
    const node = desktopScrollRef.current;
    if (!node) {
      return;
    }
    if (node.scrollWidth > node.clientWidth || timeline.months.length >= MAX_MONTH_WINDOW) {
      return;
    }
    const added = onExtendTimeline({ direction: "forward", months: MONTH_WINDOW_CHUNK });
    if (added > 0) {
      awaitingExtensionRef.current = true;
    }
  }, [onExtendTimeline, timeline.months.length]);

  useEffect(() => {
    if (scrollTargetIndex === undefined) {
      return;
    }

    const containers: Array<[HTMLDivElement | null, number]> = [
      [desktopScrollRef.current, TIMELINE_MONTH_WIDTH],
      [mobileScrollRef.current, TIMELINE_MONTH_WIDTH_MOBILE],
    ];

    containers.forEach(([container, cellWidth]) => {
      if (!container) {
        return;
      }
      const baseOffset = scrollTargetIndex * cellWidth;
      const desiredOffset =
        scrollAlign === "center"
          ? baseOffset - container.clientWidth / 2 + cellWidth / 2
          : baseOffset;
      container.scrollTo({
        left: Math.max(desiredOffset, 0),
        behavior: "smooth",
      });
    });
  }, [scrollTargetIndex, scrollAlign, scrollSignal]);

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

  const todayOffsetRatio =
    todayMonthIndex !== null
      ? (() => {
          const monthInfo = timeline.months[todayMonthIndex];
          const today = new Date();
          const daysInMonth = endOfMonth(monthInfo.startDate).getDate();
          const dayOfMonth = today.getDate();
          return Math.max(0, Math.min(1, (dayOfMonth - 1) / daysInMonth));
        })()
      : null;

  const todayLinePositionDesktop =
    todayOffsetRatio !== null
      ? (todayMonthIndex ?? 0) * TIMELINE_MONTH_WIDTH + todayOffsetRatio * TIMELINE_MONTH_WIDTH
      : null;
  const todayLinePositionMobile =
    todayOffsetRatio !== null
      ? (todayMonthIndex ?? 0) * TIMELINE_MONTH_WIDTH_MOBILE + todayOffsetRatio * TIMELINE_MONTH_WIDTH_MOBILE
      : null;

  return (
    <div className="space-y-4">
      {/* Desktop Month Gantt View */}
      <div
        className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block"
        ref={desktopScrollRef}
      >
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50">
            <div
              className="grid border-b border-slate-200"
              style={{ gridTemplateColumns: `${TIMELINE_LEFT_WIDTH}px ${timelineWidth}px` }}
            >
              <div className="sticky left-0 z-40 flex h-14 items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.05)]">
                캠페인
              </div>
              <div className="relative h-14 overflow-hidden border-l border-slate-200 bg-slate-50">
                <div className="flex h-full">
                  {timeline.months.map((month, index) => {
                    const yearInfo = timeline.years.find(
                      (y) => y.startMonthIndex <= index && index < y.startMonthIndex + y.monthCount,
                    );
                    const isFirstMonthOfYear = yearInfo?.startMonthIndex === index;
                    return (
                      <div
                        key={month.key}
                        className="relative z-25 flex h-full flex-col items-center justify-center border-r border-slate-100 px-2"
                        style={{ width: TIMELINE_MONTH_WIDTH }}
                      >
                        {isFirstMonthOfYear && yearInfo ? (
                          <span className="text-[10px] leading-none font-medium text-slate-500">{yearInfo.year}</span>
                        ) : (
                          <span className="text-[10px] leading-none" />
                        )}
                        <span className="mt-0.5 text-sm font-semibold text-slate-700">{month.label}</span>
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
                <div
                  key={row.id}
                  className="grid border-b border-slate-100"
                  style={{ gridTemplateColumns: `${TIMELINE_LEFT_WIDTH}px ${timelineWidth}px` }}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-4 shadow-[4px_0_10px_rgba(0,0,0,0.05)]",
                      rowBackgroundClass,
                    )}
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
                    className={cn("relative overflow-hidden border-l border-slate-100 bg-white", rowBackgroundClass)}
                    style={{
                      minHeight: "72px",
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white md:hidden" ref={mobileScrollRef}>
        <div style={{ minWidth: TIMELINE_LEFT_WIDTH_MOBILE + timelineWidthMobile }}>
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50">
            <div
              className="grid border-b border-slate-200"
              style={{ gridTemplateColumns: `${TIMELINE_LEFT_WIDTH_MOBILE}px ${timelineWidthMobile}px` }}
            >
              <div className="sticky left-0 z-40 flex h-12 items-center border-r border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.05)]">
                캠페인
              </div>
              <div className="relative h-12 overflow-hidden border-l border-slate-200 bg-slate-50">
                <div className="flex h-full">
                  {timeline.months.map((month, index) => {
                    const yearInfo = timeline.years.find(
                      (y) => y.startMonthIndex <= index && index < y.startMonthIndex + y.monthCount,
                    );
                    const isFirstMonthOfYear = yearInfo?.startMonthIndex === index;
                    return (
                      <div
                        key={month.key}
                        className="relative z-25 flex h-full flex-col items-center justify-center border-r border-slate-100 px-1"
                        style={{ width: TIMELINE_MONTH_WIDTH_MOBILE }}
                      >
                        {isFirstMonthOfYear && yearInfo ? (
                          <span className="text-[9px] leading-none font-medium text-slate-500">{yearInfo.year}</span>
                        ) : (
                          <span className="text-[9px] leading-none" />
                        )}
                        <span className="mt-0.5 text-[10px] font-semibold text-slate-700">{month.label}</span>
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
                <div
                  key={row.id}
                  className="grid border-b border-slate-100"
                  style={{ gridTemplateColumns: `${TIMELINE_LEFT_WIDTH_MOBILE}px ${timelineWidthMobile}px` }}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-3 shadow-[4px_0_10px_rgba(0,0,0,0.05)]",
                      rowBackgroundClass,
                    )}
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
                    className={cn("relative overflow-hidden border-l border-slate-100 bg-white", rowBackgroundClass)}
                    style={{
                      minHeight: "60px",
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

export const ScheduleCalendar = ({ days, month, schedulesByDay, columnAccess }: ScheduleCalendarProps) => {
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

