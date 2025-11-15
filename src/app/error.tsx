"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 전역 에러 바운더리 컴포넌트
 * 런타임 에러 발생 시 사용자에게 친화적인 에러 메시지를 표시합니다.
 */
const Error = ({ error, reset }: ErrorProps) => {
  useEffect(() => {
    // 에러 로깅 (프로덕션 환경에서는 구조화된 로깅 서비스로 전송)
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">오류가 발생했습니다</h1>
          <p className="text-sm text-slate-500">
            예상치 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
            <p className="text-xs font-mono text-rose-800 break-all">{error.message}</p>
            {error.digest && (
              <p className="mt-2 text-xs text-rose-600">Error ID: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            대시보드로 이동
          </a>
        </div>
      </div>
    </div>
  );
};

export default Error;

