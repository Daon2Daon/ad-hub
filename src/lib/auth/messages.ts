/**
 * 로그인 에러 메시지를 사용자 친화적인 한국어 메시지로 변환합니다.
 * @param code 에러 코드 (예: "ACCOUNT_LOCKED:900", "INVALID_CREDENTIALS:2")
 * @returns 사용자 친화적인 에러 메시지
 */
export function getSignInErrorMessage(code?: string | null): string {
  if (!code) {
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }

  // ACCOUNT_LOCKED:${seconds} 형식 파싱
  if (code.startsWith("ACCOUNT_LOCKED:")) {
    const seconds = parseInt(code.split(":")[1] || "0", 10);
    const minutes = Math.ceil(seconds / 60);
    return `보안을 위해 계정이 일시적으로 잠금되었습니다. ${minutes}분 후 다시 시도해주세요.`;
  }

  // INVALID_CREDENTIALS:${remaining} 형식 파싱
  if (code.startsWith("INVALID_CREDENTIALS:")) {
    const remaining = parseInt(code.split(":")[1] || "0", 10);
    if (remaining > 0) {
      return `아이디 또는 비밀번호가 올바르지 않습니다. (남은 시도 횟수: ${remaining}회)`;
    }
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }

  switch (code) {
    case "ACCOUNT_PENDING":
      return "관리자 승인이 완료되지 않았습니다.";
    case "ACCOUNT_DISABLED":
      return "비활성화된 계정입니다. 관리자에게 문의하세요.";
    case "CredentialsSignin":
      return "아이디 또는 비밀번호가 올바르지 않습니다.";
    default:
      return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }
}

export function getSignUpSuccessMessage() {
  return "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
}
