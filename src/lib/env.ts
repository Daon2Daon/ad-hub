import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
  // 로깅 설정
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  // 외부 로깅 서비스 설정
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  // 로그 보관 설정
  LOG_STORAGE_ENABLED: z.enum(["true", "false"]).optional(),
  LOG_STORAGE_PATH: z.string().optional(),
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
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessage = Object.entries(errors)
      .map(([key, messages]) => `${key}: ${messages?.join(", ") ?? "invalid"}`)
      .join("; ");
    throw new Error(`Invalid server environment variables: ${errorMessage}`);
  }

  cachedServerEnv = parsed.data;
  return parsed.data;
}

/**
 * 환경 변수를 명시적으로 검증합니다.
 * 앱 시작 시점에 호출하여 빌드/런타임 오류를 조기에 발견합니다.
 * @throws {Error} 환경 변수가 유효하지 않은 경우
 */
export function validateEnv(): void {
  // getServerEnv()를 호출하여 검증 수행
  // 이미 검증된 경우 캐시된 값을 반환하므로 성능 영향 없음
  getServerEnv();
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
    throw new Error(`Invalid public environment variables: ${parsed.error.flatten().fieldErrors}`);
  }

  return parsed.data;
}
