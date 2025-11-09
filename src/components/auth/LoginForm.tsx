"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

import { getSignInErrorMessage, getSignUpSuccessMessage } from "@/lib/auth/messages";

export const LoginForm = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pendingStatus = searchParams.get("status");
  const signupStatus = searchParams.get("signup");

  const infoMessage =
    pendingStatus === "pending"
      ? "관리자 승인이 완료된 후 로그인할 수 있습니다."
      : signupStatus === "success"
        ? getSignUpSuccessMessage()
        : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const result = await signIn(
      "credentials",
      {
        loginId,
        password,
        redirect: false,
      },
    );

    setSubmitting(false);

    if (!result) {
      setErrorMessage("로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (result.ok) {
      router.replace("/dashboard");
    } else {
      setErrorMessage(getSignInErrorMessage(result.error));
    }
  };

  return (
    <section className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">로그인</h1>
        <p className="text-sm text-slate-500">
          광고주 데이터 관리 시스템에 접속하려면 계정 정보를 입력하세요.
        </p>
      </header>

      {infoMessage ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {infoMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="loginId" className="block text-sm font-medium text-slate-700">
            아이디
          </label>
          <input
            id="loginId"
            type="text"
            minLength={4}
            required
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="아이디를 입력하세요"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="비밀번호를 입력하세요"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <footer className="text-center text-sm text-slate-500">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          가입 신청
        </Link>
      </footer>
    </section>
  );
};

