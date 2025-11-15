import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("logger", () => {
  const originalEnv = { ...process.env };
  const consoleSpy = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.restoreAllMocks();
  });

  describe("개발 환경", () => {
    beforeEach(async () => {
      (process.env as Record<string, string>)["NODE_ENV"] = "development";
      (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
      (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);
    });

    it("debug 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      logger.debug("Test debug message", { key: "value" });
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("info 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      logger.info("Test info message", { key: "value" });
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("warn 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      logger.warn("Test warn message", { key: "value" });
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it("error 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      const error = new Error("Test error");
      logger.error("Test error message", error, { key: "value" });
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe("프로덕션 환경", () => {
    beforeEach(async () => {
      (process.env as Record<string, string>)["NODE_ENV"] = "production";
      (process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
      (process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "a".repeat(32);
    });

    it("debug 로그를 출력하지 않아야 함", async () => {
      const { logger } = await import("./logger");
      logger.debug("Test debug message");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("info 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      logger.info("Test info message");
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("error 로그를 출력해야 함", async () => {
      const { logger } = await import("./logger");
      const error = new Error("Test error");
      logger.error("Test error message", error);
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });
});

