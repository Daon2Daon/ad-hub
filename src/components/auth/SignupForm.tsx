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
      // 개발 환경에서 전체 에러 객체 로깅
      if (process.env.NODE_ENV === "development") {
        try {
          console.error("Signup error details:", {
            serverError: error.serverError,
            validationErrors: error.validationErrors,
            thrownError: error.thrownError,
            errorKeys: Object.keys(error),
            fullError: error,
          });
        } catch (e) {
          console.error("Error logging failed:", e);
        }
      }

      let message = "가입 중 오류가 발생했습니다.";

      // Validation 에러 확인 (가장 우선순위)
      if (error.validationErrors && Object.keys(error.validationErrors).length > 0) {
        const validationMessages = Object.entries(error.validationErrors)
          .flatMap(([field, fieldErrors]) => {
            if (!fieldErrors) return [];
            
            // next-safe-action의 validation 에러 구조 처리
            if (Array.isArray(fieldErrors)) {
              return fieldErrors.map((err) => {
                if (typeof err === "string") {
                  return err;
                }
                if (
                  err &&
                  typeof err === "object" &&
                  "_errors" in err &&
                  Array.isArray((err as { _errors: unknown })._errors)
                ) {
                  return (err as { _errors: string[] })._errors.join(", ");
                }
                return String(err);
              });
            }
            
            // 중첩된 객체 구조 처리
            if (typeof fieldErrors === "object" && "_errors" in fieldErrors) {
              const nestedErrors = (fieldErrors as { _errors?: unknown[] })._errors;
              if (Array.isArray(nestedErrors)) {
                return nestedErrors.map((err) => String(err));
              }
            }
            
            return [String(fieldErrors)];
          })
          .filter(Boolean);

        if (validationMessages.length > 0) {
          message = validationMessages.join(", ");
        }
      }
      // 서버 에러 확인
      else if (error.serverError) {
        message =
          typeof error.serverError === "string"
            ? error.serverError
            : String(error.serverError);
      }
      // 기타 에러
      else if (error.thrownError) {
        message =
          error.thrownError instanceof Error
            ? error.thrownError.message
            : String(error.thrownError);
      }

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
        <Link
          href="/login"
          className="font-medium text-slate-900 underline-offset-4 hover:underline"
        >
          로그인
        </Link>
      </footer>
    </section>
  );
};
