"use client";

import { FormEvent } from "react";

import { cn } from "@/lib/utils";

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  setPassword: (password: string) => void;
  isSubmitting: boolean;
}

export const ResetPasswordModal = ({
  open,
  onClose,
  onSubmit,
  password,
  setPassword,
  isSubmitting,
}: ResetPasswordModalProps) => {
  if (!open) {
    return null;
  }

  const isValid =
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">비밀번호 재설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>
        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              사용자의 비밀번호를 강제로 재설정합니다. 재설정된 비밀번호는 사용자에게 알려주어야
              합니다.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="resetPassword" className="block text-sm font-medium text-slate-700">
              새 비밀번호
            </label>
            <input
              id="resetPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <p className="text-xs text-slate-500">
              8자 이상, 영문과 숫자를 포함해야 합니다.
            </p>
            {password && !isValid && (
              <p className="text-xs text-rose-600">비밀번호 요구사항을 만족하지 않습니다.</p>
            )}
          </div>

          <footer className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50",
                isSubmitting && "cursor-not-allowed opacity-70",
              )}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                !isValid || isSubmitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-amber-600 text-white hover:bg-amber-500",
              )}
            >
              {isSubmitting ? "재설정 중..." : "재설정"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

