import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스를 안전하게 병합하기 위한 헬퍼입니다.
 * Shadcn UI 컴포넌트 스타일 조합 시 중복 클래스를 제거합니다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
