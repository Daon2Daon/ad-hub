import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Role, UserStatus } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { createDefaultAccessProfile, toUserAccessProfile } from "@/lib/auth/profile";
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
          throw new Error("INVALID_CREDENTIALS");
        }

        const { loginId, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { loginId },
        });

        if (!user || !user.passwordHash) {
          throw new Error("INVALID_CREDENTIALS");
        }

        if (user.status !== "active") {
          throw new Error(user.status === "pending" ? "ACCOUNT_PENDING" : "ACCOUNT_DISABLED");
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
          throw new Error("INVALID_CREDENTIALS");
        }

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

