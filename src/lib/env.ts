import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
});

const clientSchema = z.object({});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * 서버 환경 변수 유효성 검증을 수행합니다.
 * 애플리케이션 시작 시 한 번만 검증하여 런타임 오류를 예방합니다.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables: ${parsed.error.flatten().fieldErrors}`,
    );
  }

  cachedServerEnv = parsed.data;
  return parsed.data;
}

/**
 * 클라이언트에서 접근 가능한 환경 변수를 검증합니다.
 * NEXT_PUBLIC_ 접두어를 사용하는 값만 허용합니다.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    // 클라이언트 노출 환경변수 추가 시 여기에 매핑
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables: ${parsed.error.flatten().fieldErrors}`,
    );
  }

  return parsed.data;
}

