import { createSafeActionClient } from "next-safe-action";

import { logger } from "@/lib/logger";

/**
 * 안전한 서버 액션 클라이언트
 * 에러 핸들링과 로깅을 위한 기본 설정 포함
 */
export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    // 구조화된 로깅
    logger.error(
      "Server action error",
      error instanceof Error ? error : new Error(String(error)),
    );

    // 프로덕션 환경에서는 민감한 에러 정보를 숨김
    if (process.env.NODE_ENV === "production") {
      return "작업 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
    // 개발 환경에서는 상세한 에러 메시지 반환
    return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  },
});
