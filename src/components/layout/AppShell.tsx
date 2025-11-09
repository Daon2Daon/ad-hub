"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";
import type { ScheduleColumnAccess } from "@/types/schedule";

interface AppShellProps {
  navItems: { href: string; label: string }[];
  children: ReactNode;
  user: {
    name?: string | null;
    loginId: string;
    role: Role;
    columnAccess: ScheduleColumnAccess;
  };
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  user: "일반 사용자",
};

export const AppShell = ({ navItems, children, user }: AppShellProps) => {
  const pathname = usePathname();

  const activeItem = navItems.find((item) => pathname.startsWith(item.href));

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6 text-lg font-semibold">
          Ad Hub
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-4 py-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{user.name ?? user.loginId}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
            <p className="mt-2 text-xs text-slate-500">
              열람 가능 컬럼:{" "}
              <span className="font-medium text-slate-700">
                {Object.entries(user.columnAccess)
                  .filter(([, canView]) => canView)
                  .map(([key]) => COLUMN_LABELS[key as keyof typeof COLUMN_LABELS])
                  .join(", ") || "권한 없음"}
              </span>
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {activeItem?.label ?? "Ad Hub"}
            </p>
            <p className="text-xs text-slate-500">
              {user.name ?? user.loginId} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <SignOutButton />
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 lg:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1 transition",
                  isActive ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

const COLUMN_LABELS: Record<keyof ScheduleColumnAccess, string> = {
  campaign: "캠페인",
  creative: "소재",
  channel: "매체",
  schedule: "일정",
  department: "담당부서",
  agency: "대행사",
};


