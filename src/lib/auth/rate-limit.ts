/**
 * 로그인 시도 레이트 리미팅 모듈
 * 브루트포스 공격 방지를 위해 로그인 시도 횟수를 추적하고 계정을 일시적으로 잠금합니다.
 */

interface LoginAttempt {
  count: number;
  lockedUntil: number | null; // 타임스탬프 (밀리초)
  firstAttemptAt: number; // 첫 시도 시각 (밀리초)
}

// 메모리 기반 저장소 (프로덕션 환경에서는 Redis 등을 사용하는 것을 권장합니다)
const loginAttempts = new Map<string, LoginAttempt>();

// 설정 상수
const MAX_ATTEMPTS = 5; // 최대 시도 횟수
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15분 (밀리초)
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1시간 (밀리초) - 이 시간 내 시도 횟수 추적

/**
 * 지정된 시간(밀리초) 후에 Map에서 항목을 제거합니다.
 * 메모리 누수를 방지하기 위해 사용됩니다.
 */
function scheduleCleanup(key: string, delayMs: number): void {
  setTimeout(() => {
    const attempt = loginAttempts.get(key);
    if (attempt) {
      // 잠금이 해제되었고, 윈도우가 지났다면 제거
      const now = Date.now();
      const isLocked = attempt.lockedUntil !== null && attempt.lockedUntil > now;
      const isWindowExpired = now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS;

      if (!isLocked && isWindowExpired) {
        loginAttempts.delete(key);
      }
    }
  }, delayMs);
}

/**
 * 로그인 시도가 잠금 상태인지 확인합니다.
 * @param loginId 사용자 로그인 ID
 * @returns 잠금 상태인 경우 남은 잠금 시간(초), 그렇지 않은 경우 null
 */
export function isLoginLocked(loginId: string): number | null {
  const attempt = loginAttempts.get(loginId);

  if (!attempt || attempt.lockedUntil === null) {
    return null;
  }

  const now = Date.now();
  if (attempt.lockedUntil > now) {
    // 잠금 상태, 남은 시간 반환 (초)
    return Math.ceil((attempt.lockedUntil - now) / 1000);
  }

  // 잠금 시간이 지났지만, 아직 윈도우 내에 있으면 카운트는 유지
  // 윈도우가 지났으면 카운트 리셋
  if (now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(loginId);
    return null;
  }

  // 잠금 시간은 지났지만 카운트 유지
  attempt.lockedUntil = null;
  return null;
}

/**
 * 로그인 시도 실패를 기록합니다.
 * 최대 시도 횟수에 도달하면 계정을 잠금합니다.
 * @param loginId 사용자 로그인 ID
 */
export function recordLoginFailure(loginId: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(loginId);

  if (!attempt) {
    // 첫 시도
    loginAttempts.set(loginId, {
      count: 1,
      lockedUntil: null,
      firstAttemptAt: now,
    });
    scheduleCleanup(loginId, ATTEMPT_WINDOW_MS);
    return;
  }

  // 윈도우가 지났으면 카운트 리셋
  if (now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    attempt.count = 1;
    attempt.firstAttemptAt = now;
    attempt.lockedUntil = null;
    scheduleCleanup(loginId, ATTEMPT_WINDOW_MS);
    return;
  }

  // 잠금 상태인 경우 카운트 증가 없이 반환
  if (attempt.lockedUntil !== null && attempt.lockedUntil > now) {
    return;
  }

  // 카운트 증가
  attempt.count += 1;

  // 최대 시도 횟수에 도달하면 잠금
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    scheduleCleanup(loginId, LOCKOUT_DURATION_MS);
  }
}

/**
 * 로그인 성공 시 시도 기록을 초기화합니다.
 * @param loginId 사용자 로그인 ID
 */
export function resetLoginAttempts(loginId: string): void {
  loginAttempts.delete(loginId);
}

/**
 * 남은 시도 횟수를 반환합니다.
 * @param loginId 사용자 로그인 ID
 * @returns 남은 시도 횟수 (MAX_ATTEMPTS - 현재 시도 횟수)
 */
export function getRemainingAttempts(loginId: string): number {
  const attempt = loginAttempts.get(loginId);
  if (!attempt) {
    return MAX_ATTEMPTS;
  }

  // 윈도우가 지났으면 리셋된 것으로 간주
  const now = Date.now();
  if (now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    return MAX_ATTEMPTS;
  }

  return Math.max(0, MAX_ATTEMPTS - attempt.count);
}

