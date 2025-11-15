import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("getServerEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 모듈 캐시 초기화
    vi.resetModules();
    // process.env 재할당
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it("유효한 환경 변수를 반환해야 함", async () => {
    (process.env as Record<string, string>)["NODE_ENV"] = "production";
    (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { getServerEnv } = await import("./env");
    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("production");
    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.NEXTAUTH_SECRET).toBe("a".repeat(32));
  });

  it("NODE_ENV 기본값을 제공해야 함", async () => {
    delete (process.env as Record<string, string | undefined>)["NODE_ENV"];
    (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { getServerEnv } = await import("./env");
    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("development");
  });

  it("필수 환경 변수가 없으면 에러를 던져야 함", async () => {
    delete (process.env as Record<string, string | undefined>)["DATABASE_URL"];
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { getServerEnv } = await import("./env");
    expect(() => getServerEnv()).toThrow();
  });

  it("NEXTAUTH_SECRET이 너무 짧으면 에러를 던져야 함", async () => {
    (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "short";

    const { getServerEnv } = await import("./env");
    expect(() => getServerEnv()).toThrow();
  });

  it("환경 변수를 캐싱해야 함", async () => {
    (process.env as Record<string, string>)["NODE_ENV"] = "production";
    (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { getServerEnv } = await import("./env");
    const env1 = getServerEnv();
    const env2 = getServerEnv();

    expect(env1).toBe(env2); // 같은 인스턴스여야 함
  });
});

describe("getClientEnv", () => {
  it("빈 객체를 반환해야 함 (현재 구현)", async () => {
    const { getClientEnv } = await import("./env");
    const env = getClientEnv();
    expect(env).toEqual({});
  });
});

describe("validateEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it("유효한 환경 변수일 때 에러를 던지지 않아야 함", async () => {
    (process.env as Record<string, string>)["NODE_ENV"] = "production";
    (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).not.toThrow();
  });

  it("유효하지 않은 환경 변수일 때 에러를 던져야 함", async () => {
    delete (process.env as Record<string, string | undefined>)["DATABASE_URL"];
    (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);

    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).toThrow();
  });
});

