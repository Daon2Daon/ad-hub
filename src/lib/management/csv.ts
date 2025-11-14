import { format, parse, parseISO } from "date-fns";

/**
 * CSV 값에 대한 안전한 이스케이프 처리
 */
export function createCsvValue(value: string): string {
  const safeValue = value.replace(/"/g, '""');
  if (safeValue.includes(",") || safeValue.includes("\n") || safeValue.includes('"')) {
    return `"${safeValue}"`;
  }
  return safeValue;
}

/**
 * 날짜를 CSV 셀 형식으로 포맷팅 (yyyy.MM.dd)
 */
export function formatDateCell(value: string | null): string {
  if (!value) {
    return "";
  }

  try {
    const date = parseISO(value);
    return format(date, "yyyy.MM.dd");
  } catch {
    return "";
  }
}

/**
 * CSV 템플릿 헤더 생성 (리포트와 동일한 형식)
 */
export function createTemplateHeaders(): string[] {
  return [
    "캠페인",
    "소재",
    "매체/구분",
    "시작일",
    "종료일",
    "광고비",
    "예산계정",
    "담당팀",
    "대행사",
  ];
}

/**
 * CSV 템플릿 파일 생성 (헤더만 포함)
 */
export function createTemplateCsv(): string {
  const headers = createTemplateHeaders();
  const csvContent = headers.map(createCsvValue).join(",");
  return `\uFEFF${csvContent}\n`;
}

/**
 * CSV 파일을 다운로드
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * CSV 파일 파싱 (BOM 제거 및 행 분리)
 */
export function parseCsvFile(fileContent: string): string[][] {
  // BOM 제거
  const content = fileContent.replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  const rows: string[][] = [];

  for (const line of lines) {
    const row = parseCsvLine(line);
    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * CSV 라인 파싱 (쉼표로 분리, 따옴표 처리)
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i++; // 다음 문자 건너뛰기
      } else {
        // 따옴표 시작/끝
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // 필드 구분자
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // 마지막 필드 추가
  result.push(current.trim());

  return result;
}

/**
 * 날짜 문자열 파싱 (yyyy.MM.dd 형식을 ISO 형식으로 변환)
 */
export function parseDateString(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  try {
    // yyyy.MM.dd 형식 파싱
    const parsed = parse(dateStr.trim(), "yyyy.MM.dd", new Date());
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return format(parsed, "yyyy-MM-dd");
  } catch {
    return null;
  }
}

/**
 * 통화 형식 문자열을 숫자로 변환 (예: "₩1,000,000" -> 1000000)
 */
export function parseCurrencyString(currencyStr: string): number | null {
  if (!currencyStr || currencyStr.trim() === "") {
    return null;
  }

  try {
    // 통화 기호 및 쉼표 제거
    const cleaned = currencyStr.replace(/[₩,\s]/g, "");
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * CSV 행을 캠페인 데이터 객체로 변환
 */
export interface ParsedCampaignRow {
  campaign: string;
  creative: string | null;
  channel: string;
  startDate: string | null;
  endDate: string | null;
  spend: number | null;
  budgetAccount: string | null;
  department: string;
  agency: string;
  rowNumber: number;
}

/**
 * CSV 행을 파싱하여 캠페인 데이터로 변환
 */
export function parseCampaignRow(
  row: string[],
  rowNumber: number,
  headers: string[],
): ParsedCampaignRow | null {
  if (row.length !== headers.length) {
    return null;
  }

  const getValue = (index: number): string => {
    return row[index]?.trim() || "";
  };

  const campaign = getValue(0);
  const creative = getValue(1);
  const channel = getValue(2);
  const startDateStr = getValue(3);
  const endDateStr = getValue(4);
  const spendStr = getValue(5);
  const budgetAccount = getValue(6);
  const department = getValue(7);
  const agency = getValue(8);

  // 필수 필드 검증
  if (!campaign || !channel || !department || !agency) {
    return null;
  }

  const startDate = parseDateString(startDateStr);
  const endDate = parseDateString(endDateStr);
  const spend = parseCurrencyString(spendStr);

  return {
    campaign,
    creative: creative || null,
    channel,
    startDate,
    endDate,
    spend,
    budgetAccount: budgetAccount || null,
    department,
    agency,
    rowNumber,
  };
}


