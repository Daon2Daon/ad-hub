import { format } from "date-fns";
import { ko } from "date-fns/locale";

import type { DateRange } from "@/types/dashboard";

interface DateRangeSummaryProps {
  label: string;
  range: DateRange;
}

export const DateRangeSummary = ({ label, range }: DateRangeSummaryProps) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
    <span className="font-medium text-slate-900">{label}</span>
    <span className="mx-2 text-slate-400">|</span>
    <span>
      {format(range.start, "yyyy년 M월 d일", { locale: ko })} ~{" "}
      {format(range.end, "yyyy년 M월 d일", { locale: ko })}
    </span>
  </div>
);
