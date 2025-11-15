import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

// next-auth 모킹
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(() => Promise.resolve({ ok: false, error: null })),
}));

// next/navigation 모킹
const mockGet = vi.fn(() => null);
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

describe("LoginForm", () => {
  it("로그인 폼을 렌더링해야 함", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("아이디와 비밀번호 입력 필드가 있어야 함", () => {
    render(<LoginForm />);

    const idInput = screen.getByLabelText("아이디");
    const passwordInput = screen.getByLabelText("비밀번호");

    expect(idInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("가입 신청 링크가 있어야 함", () => {
    render(<LoginForm />);

    const signupLink = screen.getByRole("link", { name: "가입 신청" });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("사용자가 아이디와 비밀번호를 입력할 수 있어야 함", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const idInput = screen.getByLabelText("아이디");
    const passwordInput = screen.getByLabelText("비밀번호");

    await user.type(idInput, "testuser");
    await user.type(passwordInput, "testpass123");

    expect(idInput).toHaveValue("testuser");
    expect(passwordInput).toHaveValue("testpass123");
  });
});

