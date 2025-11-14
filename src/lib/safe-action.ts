import { createSafeActionClient } from "next-safe-action";

/**
 * 안전한 서버 액션 클라이언트
 * 에러 핸들링과 로깅을 위한 기본 설정 포함
 */
export const actionClient = createSafeActionClient({
  // 서버 액션 실행 전 미들웨어 (예: 인증 체크 등)
  // handleServerError: (error) => {
  //   // 프로덕션 환경에서는 민감한 에러 정보를 숨김
  //   if (process.env.NODE_ENV === "production") {
  //     console.error("Server action error:", error);
  //     return "작업 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  //   }
  //   return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  // },
});
