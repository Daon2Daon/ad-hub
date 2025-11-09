export function getSignInErrorMessage(code?: string | null) {
  switch (code) {
    case "ACCOUNT_PENDING":
      return "관리자 승인이 완료되지 않았습니다.";
    case "ACCOUNT_DISABLED":
      return "비활성화된 계정입니다. 관리자에게 문의하세요.";
    case "CredentialsSignin":
    case "INVALID_CREDENTIALS":
    default:
      return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }
}

export function getSignUpSuccessMessage() {
  return "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
}

