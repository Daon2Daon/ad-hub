"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { actionClient } from "@/lib/safe-action";
import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { hashPassword } from "@/lib/auth/password";
import { logger } from "@/lib/logger";
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
    .optional()
    .refine(
      (val) => !val || val.length === 0 || (val.length >= 2 && val.length <= 32),
      {
        message: "이름은 2자 이상 32자 이하여야 합니다.",
      },
    )
    .transform((val) => (val && val.trim() ? val.trim() : undefined)),
});

export const signUpAction = actionClient.schema(signUpSchema).action(async ({ parsedInput }) => {
  const { loginId, email, password, name } = parsedInput;

  logger.debug("SignUp 시작", { loginId, email: email ?? null, hasName: !!name });

  // 트랜잭션을 사용하여 User와 UserAccessProfile을 원자적으로 생성
  try {
    logger.debug("SignUp 비밀번호 해싱 시작");
    const hashed = await hashPassword(password);
    logger.debug("SignUp 비밀번호 해싱 완료");

    logger.debug("SignUp 기본 프로필 생성 시작");
    const defaultProfile = createDefaultAccessProfile("user");
    logger.debug("SignUp 기본 프로필 생성 완료", {
      columnPermissionsKeys: Object.keys(defaultProfile.columnPermissions),
      departments: defaultProfile.scope.departments,
      agencies: defaultProfile.scope.agencies,
    });

    // columnPermissions를 JSON으로 명시적으로 변환
    // Prisma의 Json 타입은 JavaScript 객체를 자동으로 JSON으로 변환하지만,
    // 타입 안전성을 위해 명시적으로 변환
    logger.debug("SignUp columnPermissions JSON 변환 시작");
    const columnPermissionsJson = JSON.parse(
      JSON.stringify(defaultProfile.columnPermissions),
    ) as Prisma.InputJsonValue;
    logger.debug("SignUp columnPermissions JSON 변환 완료");

    logger.debug("SignUp 트랜잭션 시작");
    const result = await prisma.$transaction(async (tx) => {
      logger.debug("SignUp User 생성 시작");
      const user = await tx.user.create({
        data: {
          loginId,
          email: email ?? null,
          name: name ?? null,
          passwordHash: hashed,
          status: "pending",
          role: "user",
        },
        select: {
          id: true,
          status: true,
        },
      });
      logger.debug("SignUp User 생성 완료", { userId: user.id });

      // UserAccessProfile 생성
      logger.debug("SignUp UserAccessProfile 생성 시작");
      await tx.userAccessProfile.create({
        data: {
          userId: user.id,
          columnPermissions: columnPermissionsJson,
          departments: defaultProfile.scope.departments,
          agencies: defaultProfile.scope.agencies,
        },
      });
      logger.debug("SignUp UserAccessProfile 생성 완료");

      return user;
    });
    logger.debug("SignUp 트랜잭션 완료");

    logger.info("SignUp 성공", { userId: result.id, status: result.status });
    return {
      userId: result.id,
      status: result.status,
    };
  } catch (error) {
    logger.error(
      "SignUp 에러 발생",
      error instanceof Error ? error : new Error(String(error)),
      {
        errorType: error?.constructor?.name,
        isPrismaError: error instanceof Prisma.PrismaClientKnownRequestError,
        isPrismaUnknownError: error instanceof Prisma.PrismaClientUnknownRequestError,
        isPrismaValidationError: error instanceof Prisma.PrismaClientValidationError,
        loginId,
      },
    );
    // Prisma unique constraint violation 처리
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = (error.meta as { target?: string[] })?.target;
        if (target?.includes("loginId")) {
          throw new Error("이미 사용 중인 아이디입니다.");
        }
        if (target?.includes("email")) {
          throw new Error("이미 가입된 이메일입니다.");
        }
        throw new Error("이미 사용 중인 정보가 있습니다.");
      }
      // 다른 Prisma 에러 코드 처리
      logger.error(
        "Prisma error during signup",
        error,
        {
          code: error.code,
          meta: error.meta,
        },
      );
      throw new Error(
        `데이터베이스 오류가 발생했습니다. (코드: ${error.code}) 잠시 후 다시 시도해주세요.`,
      );
    }
    // 기타 에러
    logger.error(
      "Error during signup",
      error instanceof Error ? error : new Error(String(error)),
      { loginId },
    );
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    throw new Error(`가입 처리 중 오류: ${errorMessage}`);
  }
});
