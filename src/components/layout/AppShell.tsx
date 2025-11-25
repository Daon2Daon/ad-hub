"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState, useEffect } from "react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeItem = navItems.find((item) => pathname.startsWith(item.href));

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-100 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-60 xl:w-64">
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
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{user.name ?? user.loginId}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-600 bg-opacity-75 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white pb-4 pt-5">
            <div className="flex items-center justify-between px-4">
              <div className="text-lg font-semibold text-slate-900">Ad Hub</div>
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg
                  className="h-6 w-6 text-slate-900"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="mt-5 h-full flex-shrink-0 overflow-y-auto px-2">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center rounded-md px-2 py-2 text-base font-medium",
                        isActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-base font-medium text-slate-700">
                    {user.name ?? user.loginId}
                  </p>
                  <p className="text-sm font-medium text-slate-500">{ROLE_LABEL[user.role]}</p>
                </div>
              </div>
              <div className="mt-4">
                <SignOutButton className="w-full justify-center" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="border-r border-slate-200 pr-4 text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500 lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {activeItem?.label ?? "Ad Hub"}
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                {user.name ?? user.loginId} · {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignOutButton />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
};
