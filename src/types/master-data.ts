export const MASTER_DATA_CATEGORIES = [
  "campaign",
  "creative",
  "channel",
  "budgetAccount",
  "department",
  "agency",
] as const;

export type MasterDataCategory = (typeof MASTER_DATA_CATEGORIES)[number];

export interface MasterDataItem {
  id: string;
  category: MasterDataCategory;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterDataCategoryMeta {
  key: MasterDataCategory;
  label: string;
  description: string;
  placeholder: string;
}

export const MASTER_DATA_CATEGORY_META: Record<MasterDataCategory, MasterDataCategoryMeta> = {
  campaign: {
    key: "campaign",
    label: "캠페인",
    description: "캠페인 이름을 사전에 등록하고 관리합니다.",
    placeholder: "새 캠페인 이름",
  },
  creative: {
    key: "creative",
    label: "소재",
    description: "광고 소재 이름을 관리합니다.",
    placeholder: "새 소재 이름",
  },
  channel: {
    key: "channel",
    label: "매체/구분",
    description: "매체 또는 구분 기준 값을 관리합니다.",
    placeholder: "새 매체/구분",
  },
  budgetAccount: {
    key: "budgetAccount",
    label: "예산계정",
    description: "예산 계정 값을 관리합니다.",
    placeholder: "새 예산계정 이름",
  },
  department: {
    key: "department",
    label: "담당팀",
    description: "담당 부서/팀 정보를 관리합니다.",
    placeholder: "새 담당팀 이름",
  },
  agency: {
    key: "agency",
    label: "대행사",
    description: "대행사 정보를 관리합니다.",
    placeholder: "새 대행사 이름",
  },
};

