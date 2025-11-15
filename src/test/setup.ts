/**
 * Vitest 테스트 환경 설정
 */
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import "@testing-library/jest-dom/vitest";

// Testing Library matchers 확장
expect.extend(matchers);

// 각 테스트 후 DOM 정리
afterEach(() => {
  cleanup();
});

// 환경 변수 모킹
(process.env as Record<string, string>)["NODE_ENV"] = "test";
(process.env as Record<string, string>)["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
(process.env as Record<string, string>)["NEXTAUTH_SECRET"] = "test-secret-key-for-testing-purposes-only-min-32-chars";

