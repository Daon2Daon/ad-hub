"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";

import { signUpAction } from "@/lib/auth/actions";

export const SignupForm = () => {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { execute, isExecuting } = useAction(signUpAction, {
    onSuccess: () => {
      router.push("/login?signup=success");
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string"
          ? error.serverError
          : "가입 중 오류가 발생했습니다.";
      setErrorMessage(message);
    },
  });

  const handleSubmit = (formData: FormData) => {
    setErrorMessage(null);
    execute({
      loginId: formData.get("loginId")?.toString() ?? "",
      password: formData.get("password")?.toString() ?? "",
      name: formData.get("name")?.toString() || undefined,
      email: formData.get("email")?.toString() || undefined,
    });
  };

  return (
    <section className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">가입 신청</h1>
        <p className="text-sm text-slate-500">
          관리자 승인 후 시스템 접속이 허용됩니다. 기본 권한은 승인 이후 부여됩니다.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="loginId" className="block text-sm font-medium text-slate-700">
            아이디
          </label>
          <input
            id="loginId"
            name="loginId"
            type="text"
            minLength={4}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="아이디를 입력하세요"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            이메일 (선택)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            이름 (선택)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="홍길동"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="영문, 숫자 포함 8자 이상"
          />
        </div>

        <button
          type="submit"
          disabled={isExecuting}
          className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isExecuting ? "제출 중..." : "가입 신청"}
        </button>
      </form>

      <footer className="text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          로그인
        </Link>
      </footer>
    </section>
  );
};

