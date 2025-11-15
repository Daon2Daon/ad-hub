import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 클라이언트 인스턴스
 * 서버리스 환경에서 연결 풀 관리를 위해 글로벌 인스턴스를 재사용합니다.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // 서버리스 환경에서 연결 풀 최적화
    // connection_limit는 DATABASE_URL의 connection_limit 파라미터로도 설정 가능
    // 기본값: 10 (서버리스 환경에 적합)
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 애플리케이션 종료 시 Prisma 클라이언트 정리
if (typeof window === "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}
