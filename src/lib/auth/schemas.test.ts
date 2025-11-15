import { describe, it, expect } from "vitest";
import { columnKeySchema, dataScopeSchema, userAccessProfileSchema, roleSchema } from "./schemas";

describe("columnKeySchema", () => {
  it("유효한 컬럼 키를 검증해야 함", () => {
    expect(() => columnKeySchema.parse("campaign")).not.toThrow();
    expect(() => columnKeySchema.parse("spend")).not.toThrow();
    expect(() => columnKeySchema.parse("agency")).not.toThrow();
  });

  it("유효하지 않은 컬럼 키를 거부해야 함", () => {
    expect(() => columnKeySchema.parse("invalid")).toThrow();
    expect(() => columnKeySchema.parse("")).toThrow();
  });
});

describe("roleSchema", () => {
  it("유효한 역할을 검증해야 함", () => {
    expect(() => roleSchema.parse("admin")).not.toThrow();
    expect(() => roleSchema.parse("user")).not.toThrow();
  });

  it("유효하지 않은 역할을 거부해야 함", () => {
    expect(() => roleSchema.parse("invalid")).toThrow();
    expect(() => roleSchema.parse("")).toThrow();
  });
});

describe("dataScopeSchema", () => {
  it("유효한 데이터 스코프를 검증해야 함", () => {
    const validScope = {
      departments: ["A팀", "B팀"],
      agencies: ["A대행사"],
    };

    expect(() => dataScopeSchema.parse(validScope)).not.toThrow();
  });

  it("빈 배열을 허용해야 함", () => {
    const emptyScope = {
      departments: [],
      agencies: [],
    };

    expect(() => dataScopeSchema.parse(emptyScope)).not.toThrow();
  });

  it("기본값을 제공해야 함", () => {
    const result = dataScopeSchema.parse({});
    expect(result.departments).toEqual([]);
    expect(result.agencies).toEqual([]);
  });

  it("유효하지 않은 타입을 거부해야 함", () => {
    expect(() => dataScopeSchema.parse({ departments: "invalid" })).toThrow();
    expect(() => dataScopeSchema.parse({ agencies: 123 })).toThrow();
  });
});

describe("userAccessProfileSchema", () => {
  it("유효한 사용자 접근 프로필을 검증해야 함", () => {
    const validProfile = {
      role: "user",
      columnPermissions: {
        campaign: true,
        creative: true,
        channel: true,
        schedule: true,
        spend: false,
        budgetAccount: true,
        department: true,
        agency: true,
      },
      scope: {
        departments: ["A팀"],
        agencies: [],
      },
    };

    expect(() => userAccessProfileSchema.parse(validProfile)).not.toThrow();
  });

  it("필수 필드를 검증해야 함", () => {
    expect(() => userAccessProfileSchema.parse({})).toThrow();
    expect(() => userAccessProfileSchema.parse({ role: "user" })).toThrow();
  });
});

