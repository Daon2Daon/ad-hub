"use server";

import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";
import { createDefaultAccessProfile } from "@/lib/auth/profile";

type RequireSessionOptions = {
  redirectTo?: string;
};

type RequireActiveSessionOptions = RequireSessionOptions & {
  pendingRedirectTo?: string;
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function requireSession(options?: RequireSessionOptions): Promise<Session> {
  const session = await getServerAuthSession();

  if (!session) {
    redirect(options?.redirectTo ?? "/login");
  }

  return session;
}

export async function requireActiveSession(
  options?: RequireActiveSessionOptions,
): Promise<Session> {
  const session = await requireSession(options);

  if (session.user.status !== "active") {
    redirect(options?.pendingRedirectTo ?? "/login?status=pending");
  }

  if (!session.accessProfile) {
    session.accessProfile = createDefaultAccessProfile(session.user.role);
  }

  return session;
}
