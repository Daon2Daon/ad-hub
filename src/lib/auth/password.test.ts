import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("비밀번호를 해시해야 함", async () => {
    const plainPassword = "testPassword123";
    const hash = await hashPassword(plainPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainPassword);
    expect(hash.length).toBeGreaterThan(0);
  });

  it("같은 비밀번호라도 다른 해시를 생성해야 함", async () => {
    const plainPassword = "testPassword123";
    const hash1 = await hashPassword(plainPassword);
    const hash2 = await hashPassword(plainPassword);

    // bcrypt는 매번 다른 salt를 사용하므로 해시가 달라야 함
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("올바른 비밀번호를 검증해야 함", async () => {
    const plainPassword = "testPassword123";
    const hash = await hashPassword(plainPassword);

    const isValid = await verifyPassword(plainPassword, hash);
    expect(isValid).toBe(true);
  });

  it("잘못된 비밀번호를 거부해야 함", async () => {
    const plainPassword = "testPassword123";
    const wrongPassword = "wrongPassword456";
    const hash = await hashPassword(plainPassword);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("빈 해시를 거부해야 함", async () => {
    const isValid = await verifyPassword("anyPassword", "");
    expect(isValid).toBe(false);
  });

  it("null 해시를 거부해야 함", async () => {
    // @ts-expect-error - 테스트를 위해 null 전달
    const isValid = await verifyPassword("anyPassword", null);
    expect(isValid).toBe(false);
  });
});

