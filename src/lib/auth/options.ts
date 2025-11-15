import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Role, UserStatus } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import {
  getRemainingAttempts,
  isLoginLocked,
  recordLoginFailure,
  resetLoginAttempts,
} from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { createDefaultAccessProfile, toUserAccessProfile } from "@/lib/auth/profile";
import { logLoginFailure, logLoginSuccess } from "@/lib/logs/logger";
import { prisma } from "@/lib/prisma";
import type { UserAccessProfile } from "@/types/auth";

const credentialsSchema = z.object({
  loginId: z
    .string()
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .regex(/^[a-zA-Z0-9_\-]+$/, "아이디는 영문, 숫자, -, _만 사용할 수 있습니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type TokenPayload = {
  sub?: string;
  role?: Role;
  status?: UserStatus;
  accessProfile?: UserAccessProfile;
  loginId?: string;
};

async function enrichToken(payload: TokenPayload): Promise<TokenPayload> {
  if (!payload.sub) {
    return payload;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { accessProfile: true },
  });

  if (!user) {
    return payload;
  }

  return {
    sub: user.id,
    role: user.role,
    status: user.status,
    accessProfile: toUserAccessProfile(user),
    loginId: user.loginId,
  };
}

const env = getServerEnv();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24시간 (초 단위)
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24시간 (초 단위)
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "아이디 로그인",
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          const loginId = credentials?.loginId as string | undefined;
          if (loginId) {
            recordLoginFailure(loginId);
            await logLoginFailure(loginId, "입력 형식 오류");
          }
          throw new Error("INVALID_CREDENTIALS");
        }

        const { loginId, password } = parsed.data;

        // 레이트 리미팅 체크: 계정이 잠금 상태인지 확인
        const lockRemainingSeconds = isLoginLocked(loginId);
        if (lockRemainingSeconds !== null) {
          await logLoginFailure(
            loginId,
            `계정 일시 잠금 (남은 시간: ${Math.ceil(lockRemainingSeconds / 60)}분)`,
          );
          throw new Error(`ACCOUNT_LOCKED:${lockRemainingSeconds}`);
        }

        const user = await prisma.user.findUnique({
          where: { loginId },
        });

        if (!user || !user.passwordHash) {
          recordLoginFailure(loginId);
          await logLoginFailure(loginId, "사용자 없음 또는 비밀번호 없음");
          const remaining = getRemainingAttempts(loginId);
          throw new Error(`INVALID_CREDENTIALS:${remaining}`);
        }

        if (user.status !== "active") {
          const reason = user.status === "pending" ? "승인 대기 중" : "계정 비활성화";
          await logLoginFailure(loginId, reason);
          throw new Error(user.status === "pending" ? "ACCOUNT_PENDING" : "ACCOUNT_DISABLED");
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
          recordLoginFailure(loginId);
          const remaining = getRemainingAttempts(loginId);
          await logLoginFailure(loginId, `비밀번호 불일치 (남은 시도: ${remaining}회)`);

          // 계정이 잠금되었는지 다시 확인
          const lockRemainingSecondsAfterFailure = isLoginLocked(loginId);
          if (lockRemainingSecondsAfterFailure !== null) {
            throw new Error(`ACCOUNT_LOCKED:${lockRemainingSecondsAfterFailure}`);
          }

          throw new Error(`INVALID_CREDENTIALS:${remaining}`);
        }

        // 로그인 성공: 시도 기록 초기화
        resetLoginAttempts(loginId);

        // 로그인 성공 로그 기록
        await logLoginSuccess(user.id, user.loginId);

        return {
          id: user.id,
          loginId: user.loginId,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      let payload: TokenPayload = {
        sub: token.sub ?? (user as { id?: string })?.id,
        role: (token as TokenPayload).role,
        status: (token as TokenPayload).status,
        accessProfile: (token as TokenPayload).accessProfile,
        loginId: (token as TokenPayload).loginId,
      };

      if (user) {
        payload = {
          ...payload,
          role: (user as { role?: Role }).role ?? payload.role,
          status: (user as { status?: UserStatus }).status ?? payload.status,
          loginId: (user as { loginId?: string }).loginId ?? payload.loginId,
        };
      }

      if (!payload.role || !payload.status || !payload.accessProfile || !payload.loginId) {
        payload = await enrichToken(payload);
      }

      return { ...token, ...payload };
    },
    async session({ session, token }) {
      const payload = token as TokenPayload;

      if (!session.user || !payload.sub) {
        return session;
      }

      session.user.id = payload.sub;
      session.user.loginId = payload.loginId ?? session.user.loginId ?? "";
      session.user.role = payload.role ?? "user";
      session.user.status = payload.status ?? "pending";
      session.accessProfile =
        payload.accessProfile ?? createDefaultAccessProfile(session.user.role);

      return session;
    },
  },
};
