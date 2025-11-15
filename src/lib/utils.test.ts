import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (className utility)", () => {
  it("단일 클래스를 반환해야 함", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("여러 클래스를 병합해야 함", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("중복된 Tailwind 클래스를 올바르게 처리해야 함", () => {
    // tailwind-merge가 중복 클래스를 해결
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500"); // 마지막 클래스가 우선
  });

  it("조건부 클래스를 처리해야 함", () => {
    expect(cn("base-class", false && "hidden", true && "visible")).toBe("base-class visible");
  });

  it("빈 값들을 무시해야 함", () => {
    expect(cn("", null, undefined, "valid-class")).toBe("valid-class");
  });

  it("배열을 처리해야 함", () => {
    expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
  });
});

