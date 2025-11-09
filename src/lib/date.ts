import { format } from "date-fns";

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환합니다.
 */
export function formatDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/**
 * Date 객체가 지정된 범위 내에 있는지 여부를 반환합니다(시작/종료 포함).
 */
export function isWithinRange(target: Date, start: Date, end: Date) {
  return target >= start && target <= end;
}

/**
 * 두 날짜 범위가 겹치는지 여부를 확인합니다.
 */
export function rangesOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start <= b.end && b.start <= a.end;
}

