import type { MasterDataCategory } from "@/types/master-data";

/**
 * 마스터 데이터 카테고리별 한글 라벨
 */
export const MASTER_DATA_CATEGORY_LABELS: Record<MasterDataCategory, string> = {
  campaign: "캠페인",
  creative: "소재",
  channel: "매체/구분",
  budgetAccount: "예산계정",
  department: "담당부서",
  agency: "대행사",
} as const;

/**
 * CSV 파일 최대 크기 (10MB)
 */
export const MAX_CSV_FILE_SIZE = 10 * 1024 * 1024;

