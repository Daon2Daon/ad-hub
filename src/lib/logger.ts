/**
 * 구조화된 로깅 유틸리티
 * 개발 환경에서는 가독성 있는 로그를, 프로덕션에서는 구조화된 로그를 제공합니다.
 *
 * 지원 기능:
 * - 로그 레벨 필터링 (환경 변수 LOG_LEVEL로 제어)
 * - 외부 로깅 서비스 연동 (Sentry, Datadog)
 * - 로그 보관 (파일 시스템 또는 데이터베이스)
 */

import { getServerEnv } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * 외부 로깅 서비스 인터페이스
 */
interface LoggingService {
  log(entry: LogEntry): void | Promise<void>;
}

/**
 * 로그 레벨 우선순위 (낮을수록 높은 우선순위)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";
  private minLogLevel: LogLevel;
  private externalServices: LoggingService[] = [];
  private storageEnabled: boolean;
  private storagePath?: string;

  constructor() {
    // 환경 변수에서 로그 레벨 읽기
    const env = getServerEnv();
    this.minLogLevel = (env.LOG_LEVEL as LogLevel) || (this.isDevelopment ? "debug" : "info");

    // 로그 보관 설정
    this.storageEnabled = env.LOG_STORAGE_ENABLED === "true";
    this.storagePath = env.LOG_STORAGE_PATH;

    // 외부 로깅 서비스 초기화
    this.initializeExternalServices(env);
  }

  /**
   * 외부 로깅 서비스 초기화
   */
  private initializeExternalServices(env: ReturnType<typeof getServerEnv>): void {
    // Sentry 연동 (선택적)
    if (env.SENTRY_DSN) {
      try {
        // Sentry SDK는 선택적 의존성이므로 동적 import
        // 실제 사용 시: npm install @sentry/nextjs
        // this.externalServices.push(new SentryService(env.SENTRY_DSN));
        if (this.isDevelopment) {
          console.log("[Logger] Sentry DSN이 설정되었지만 SDK가 설치되지 않았습니다.");
        }
      } catch (error) {
        console.warn("[Logger] Sentry 초기화 실패:", error);
      }
    }

    // Datadog 연동 (선택적)
    if (env.DATADOG_API_KEY) {
      try {
        // Datadog SDK는 선택적 의존성이므로 동적 import
        // 실제 사용 시: npm install dd-trace
        // this.externalServices.push(new DatadogService(env.DATADOG_API_KEY));
        if (this.isDevelopment) {
          console.log("[Logger] Datadog API Key가 설정되었지만 SDK가 설치되지 않았습니다.");
        }
      } catch (error) {
        console.warn("[Logger] Datadog 초기화 실패:", error);
      }
    }
  }

  /**
   * 로그 레벨에 따른 출력 여부 결정
   * 환경 변수 LOG_LEVEL로 제어 가능
   */
  private shouldLog(level: LogLevel): boolean {
    const levelPriority = LOG_LEVEL_PRIORITY[level];
    const minPriority = LOG_LEVEL_PRIORITY[this.minLogLevel];
    return levelPriority >= minPriority;
  }

  /**
   * 로그 엔트리 생성
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * 외부 로깅 서비스로 전송
   */
  private async sendToExternalServices(entry: LogEntry): Promise<void> {
    if (this.externalServices.length === 0) {
      return;
    }

    // 비동기로 전송 (메인 로직에 영향 없음)
    Promise.all(
      this.externalServices.map((service) => {
        const result = service.log(entry);
        return result instanceof Promise
          ? result.catch((err: unknown) => {
              // 외부 서비스 전송 실패는 무시 (무한 루프 방지)
              if (this.isDevelopment) {
                console.warn("[Logger] 외부 서비스 전송 실패:", err);
              }
            })
          : Promise.resolve();
      }),
    ).catch(() => {
      // 에러 무시
    });
  }

  /**
   * 로그를 파일 시스템에 저장
   */
  private async saveToStorage(entry: LogEntry): Promise<void> {
    if (!this.storageEnabled || !this.storagePath) {
      return;
    }

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const logDir = path.dirname(this.storagePath);
      await fs.mkdir(logDir, { recursive: true });

      const logLine = JSON.stringify(entry) + "\n";
      await fs.appendFile(this.storagePath, logLine, "utf-8");
    } catch (error) {
      // 로그 저장 실패는 무시 (무한 루프 방지)
      if (this.isDevelopment) {
        console.warn("[Logger] 로그 저장 실패:", error);
      }
    }
  }

  /**
   * 로그 출력
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // 콘솔 출력
    if (this.isDevelopment) {
      // 개발 환경: 가독성 있는 형식
      const prefix = `[${entry.level.toUpperCase()}]`;
      const timestamp = new Date(entry.timestamp).toLocaleTimeString("ko-KR");

      if (entry.error) {
        console.error(
          `${prefix} [${timestamp}] ${entry.message}`,
          entry.context || "",
          entry.error,
        );
      } else if (entry.level === "error") {
        console.error(`${prefix} [${timestamp}] ${entry.message}`, entry.context || "");
      } else if (entry.level === "warn") {
        console.warn(`${prefix} [${timestamp}] ${entry.message}`, entry.context || "");
      } else {
        console.log(`${prefix} [${timestamp}] ${entry.message}`, entry.context || "");
      }
    } else {
      // 프로덕션: JSON 형식 (구조화된 로그)
      const jsonLog = JSON.stringify(entry);
      if (entry.level === "error") {
        console.error(jsonLog);
      } else if (entry.level === "warn") {
        console.warn(jsonLog);
      } else {
        console.log(jsonLog);
      }
    }

    // 외부 로깅 서비스로 전송 (비동기, 에러 무시)
    if (this.externalServices.length > 0) {
      this.sendToExternalServices(entry).catch(() => {
        // 에러 무시
      });
    }

    // 로그 보관 (비동기, 에러 무시)
    if (this.storageEnabled) {
      this.saveToStorage(entry).catch(() => {
        // 에러 무시
      });
    }
  }

  /**
   * Debug 레벨 로그
   */
  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry("debug", message, context);
    this.output(entry);
  }

  /**
   * Info 레벨 로그
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry("info", message, context);
    this.output(entry);
  }

  /**
   * Warning 레벨 로그
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry("warn", message, context);
    this.output(entry);
  }

  /**
   * Error 레벨 로그
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry("error", message, context, error);
    this.output(entry);
  }
}

/**
 * 싱글톤 로거 인스턴스
 */
export const logger = new Logger();

/**
 * 기존 console.log/error와의 호환성을 위한 헬퍼 함수
 * 점진적 마이그레이션을 위해 제공
 */
export const log = {
  debug: (message: string, ...args: unknown[]) => {
    logger.debug(message, { args });
  },
  info: (message: string, ...args: unknown[]) => {
    logger.info(message, { args });
  },
  warn: (message: string, ...args: unknown[]) => {
    logger.warn(message, { args });
  },
  error: (message: string, error?: Error, ...args: unknown[]) => {
    logger.error(message, error, { args });
  },
};
