import { describe, it, expect } from "vitest";
import { formatDate, isWithinRange, rangesOverlap } from "./date";

describe("formatDate", () => {
  it("날짜를 YYYY-MM-DD 형식으로 변환해야 함", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(formatDate(date)).toBe("2024-01-15");
  });

  it("다양한 날짜 형식을 올바르게 처리해야 함", () => {
    const date1 = new Date("2024-12-31");
    expect(formatDate(date1)).toBe("2024-12-31");

    const date2 = new Date("2023-06-01");
    expect(formatDate(date2)).toBe("2023-06-01");
  });
});

describe("isWithinRange", () => {
  it("범위 내의 날짜를 올바르게 감지해야 함", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-12-31");
    const target = new Date("2024-06-15");

    expect(isWithinRange(target, start, end)).toBe(true);
  });

  it("범위 시작일을 포함해야 함", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-12-31");
    const target = new Date("2024-01-01");

    expect(isWithinRange(target, start, end)).toBe(true);
  });

  it("범위 종료일을 포함해야 함", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-12-31");
    const target = new Date("2024-12-31");

    expect(isWithinRange(target, start, end)).toBe(true);
  });

  it("범위 밖의 날짜를 올바르게 감지해야 함", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-12-31");
    const before = new Date("2023-12-31");
    const after = new Date("2025-01-01");

    expect(isWithinRange(before, start, end)).toBe(false);
    expect(isWithinRange(after, start, end)).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("겹치는 범위를 올바르게 감지해야 함", () => {
    const range1 = { start: new Date("2024-01-01"), end: new Date("2024-06-30") };
    const range2 = { start: new Date("2024-04-01"), end: new Date("2024-12-31") };

    expect(rangesOverlap(range1, range2)).toBe(true);
  });

  it("겹치지 않는 범위를 올바르게 감지해야 함", () => {
    const range1 = { start: new Date("2024-01-01"), end: new Date("2024-03-31") };
    const range2 = { start: new Date("2024-04-01"), end: new Date("2024-12-31") };

    expect(rangesOverlap(range1, range2)).toBe(false);
  });

  it("인접한 범위를 올바르게 처리해야 함", () => {
    const range1 = { start: new Date("2024-01-01"), end: new Date("2024-03-31") };
    const range2 = { start: new Date("2024-03-31"), end: new Date("2024-12-31") };

    expect(rangesOverlap(range1, range2)).toBe(true); // 종료일과 시작일이 같으면 겹침
  });

  it("완전히 포함된 범위를 올바르게 감지해야 함", () => {
    const range1 = { start: new Date("2024-01-01"), end: new Date("2024-12-31") };
    const range2 = { start: new Date("2024-04-01"), end: new Date("2024-06-30") };

    expect(rangesOverlap(range1, range2)).toBe(true);
  });
});

