"use server";

import { z } from "zod";

import { actionClient } from "@/lib/safe-action";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const signUpSchema = z.object({
  loginId: z
    .string()
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .regex(/^[a-zA-Z0-9_\-]+$/, "아이디는 영문, 숫자, -, _만 사용할 수 있습니다."),
  email: z.string().email("이메일 형식이 올바르지 않습니다.").optional(),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[A-Za-z]/, "비밀번호에 영문이 포함되어야 합니다.")
    .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다."),
  name: z
    .string()
    .min(2, "이름은 2자 이상이어야 합니다.")
    .max(32, "이름은 32자를 넘을 수 없습니다.")
    .optional(),
});

export const signUpAction = actionClient
  .schema(signUpSchema)
  .action(async ({ parsedInput }) => {
    const { loginId, email, password, name } = parsedInput;

    const existing = await prisma.user.findUnique({
      where: { loginId },
    });

    if (existing) {
      throw new Error("이미 사용 중인 아이디입니다.");
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new Error("이미 가입된 이메일입니다.");
      }
    }

    const hashed = await hashPassword(password);
    const defaultProfile = createDefaultAccessProfile("user");

    const user = await prisma.user.create({
      data: {
        loginId,
        email: email ?? null,
        name: name ?? null,
        passwordHash: hashed,
        status: "pending",
        role: "user",
        accessProfile: {
          create: {
            columnPermissions: defaultProfile.columnPermissions,
            departments: defaultProfile.scope.departments,
            agencies: defaultProfile.scope.agencies,
          },
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      userId: user.id,
      status: user.status,
    };
  });

