import type { Metadata } from "next";
import { ReactNode } from "react";

import "@/app/globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { getServerAuthSession } from "@/lib/auth/session";
import { buildScheduleColumnAccess } from "@/lib/schedule/utils";
import type { Role } from "@/types/auth";

interface NavigationItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAVIGATION: NavigationItem[] = [
  { href: "/dashboard", label: "대시보드", roles: ["admin", "user"] },
  { href: "/schedule", label: "매체 스케줄", roles: ["admin", "user"] },
  { href: "/management", label: "광고집행 관리", roles: ["admin", "user"] },
  { href: "/report", label: "리포트", roles: ["admin", "user"] },
  { href: "/masterdata", label: "마스터 데이터 관리", roles: ["admin"] },
  { href: "/logs", label: "활동 로그", roles: ["admin"] },
  { href: "/system", label: "시스템 관리", roles: ["admin"] },
];

export const metadata: Metadata = {
  title: "Ad Hub",
  description: "광고주 데이터 관리 시스템",
};

interface RootLayoutProps {
  children: ReactNode;
}

const Layout = async ({ children }: RootLayoutProps) => {
  const session = await getServerAuthSession();

  if (!session) {
    return (
      <html lang="ko">
        <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
      </html>
    );
  }

  const profile = session.accessProfile ?? createDefaultAccessProfile(session.user.role);
  const columnAccess = buildScheduleColumnAccess(profile);

  const navItems = NAVIGATION.filter((item) => item.roles.includes(session.user.role));

  return (
    <html lang="ko">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <AppShell
          navItems={navItems}
          user={{
            name: session.user.name,
            loginId: session.user.loginId,
            role: session.user.role,
            columnAccess,
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
};

export default Layout;
