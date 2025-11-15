# 로깅 시스템 사용 가이드

## 개요

이 프로젝트는 구조화된 로깅 시스템을 제공하며, 다음 기능을 지원합니다:

1. **로그 레벨 필터링**: 환경 변수로 로그 출력 레벨 제어
2. **외부 로깅 서비스 연동**: Sentry, Datadog 등과 연동
3. **로그 보관**: 파일 시스템 또는 데이터베이스에 로그 저장

## 각 기능의 효과

### 1. 로그 레벨 필터링

**효과:**
- ✅ **성능 최적화**: 프로덕션에서 불필요한 로그 제거로 I/O 부하 감소
- ✅ **디버깅 효율성**: 필요한 레벨의 로그만 출력하여 문제 파악 시간 단축
- ✅ **환경별 제어**: 개발/스테이징/프로덕션 환경별로 다른 로그 레벨 설정 가능
- ✅ **비용 절감**: 클라우드 로깅 서비스 사용 시 로그 양 감소로 비용 절감

**사용법:**
```bash
# .env 파일에 추가
LOG_LEVEL=info  # debug, info, warn, error 중 선택
```

**예시:**
- `LOG_LEVEL=error`: 에러만 출력 (프로덕션 최적화)
- `LOG_LEVEL=warn`: 경고 이상만 출력
- `LOG_LEVEL=info`: 정보 이상 출력 (기본값)
- `LOG_LEVEL=debug`: 모든 로그 출력 (개발 환경)

### 2. 외부 로깅 서비스 연동

**효과:**
- ✅ **실시간 모니터링**: 에러 발생 시 즉시 알림 수신
- ✅ **에러 추적**: 스택 트레이스, 사용자 컨텍스트, 발생 빈도 등 상세 정보
- ✅ **대시보드**: 시각화된 에러 통계 및 트렌드 분석
- ✅ **성능 모니터링**: 응답 시간, 처리량 등 성능 메트릭 수집
- ✅ **알림 통합**: Slack, 이메일, PagerDuty 등과 연동
- ✅ **에러 그룹핑**: 유사한 에러를 자동으로 그룹화하여 분석 효율성 향상

**Sentry 연동:**

1. 패키지 설치:
```bash
npm install @sentry/nextjs
```

2. 환경 변수 설정:
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

3. Sentry 초기화 (선택적, 별도 설정 파일에서):
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

**Datadog 연동:**

1. 패키지 설치:
```bash
npm install dd-trace
```

2. 환경 변수 설정:
```bash
DATADOG_API_KEY=your-datadog-api-key
```

### 3. 로그 보관

**효과:**
- ✅ **장기 보관**: 법적 요구사항이나 규정 준수를 위한 로그 보관
- ✅ **분석 및 리포팅**: 과거 데이터 분석을 통한 트렌드 파악
- ✅ **감사 추적**: 보안 감사 및 규정 준수 검증
- ✅ **문제 재현**: 과거 로그를 통해 문제 상황 재현 및 분석
- ✅ **성능 분석**: 장기간 성능 데이터 수집 및 분석

**사용법:**

1. 환경 변수 설정:
```bash
LOG_STORAGE_ENABLED=true
LOG_STORAGE_PATH=/var/log/app/application.log
```

2. 로그 파일 관리:
- 로그 로테이션: `logrotate` 등으로 자동 관리
- 로그 압축: 오래된 로그는 압축하여 저장 공간 절약
- 로그 삭제: 보관 기간에 따라 자동 삭제

**데이터베이스 저장 (선택적 확장):**

데이터베이스에 로그를 저장하려면 `logger.ts`의 `saveToStorage` 메서드를 수정:

```typescript
private async saveToStorage(entry: LogEntry): Promise<void> {
  if (!this.storageEnabled) return;
  
  // Prisma를 사용한 DB 저장 예시
  await prisma.applicationLog.create({
    data: {
      level: entry.level,
      message: entry.message,
      timestamp: new Date(entry.timestamp),
      context: entry.context,
      error: entry.error,
    },
  });
}
```

## 실제 사용 예시

### 기본 사용

```typescript
import { logger } from "@/lib/logger";

// Debug 로그 (개발 환경에서만)
logger.debug("사용자 로그인 시도", { userId: "123" });

// Info 로그
logger.info("캠페인 생성 완료", { campaignId: "456" });

// Warning 로그
logger.warn("API 응답 시간 경고", { duration: 5000 });

// Error 로그
logger.error("데이터베이스 연결 실패", error, { 
  host: "db.example.com",
  port: 5432,
});
```

### 환경별 설정 예시

**개발 환경 (.env.development):**
```bash
LOG_LEVEL=debug
LOG_STORAGE_ENABLED=false
```

**프로덕션 환경 (.env.production):**
```bash
LOG_LEVEL=warn
LOG_STORAGE_ENABLED=true
LOG_STORAGE_PATH=/var/log/app/application.log
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 성능 고려사항

1. **비동기 처리**: 외부 서비스 전송과 로그 저장은 비동기로 처리되어 메인 로직에 영향 없음
2. **에러 무시**: 외부 서비스 전송 실패 시 무시하여 무한 루프 방지
3. **선택적 활성화**: 필요한 기능만 활성화하여 오버헤드 최소화

## 모니터링 및 알림 설정

### Sentry 알림 설정

1. Sentry 대시보드에서 알림 규칙 생성
2. 에러 발생 빈도, 심각도 등에 따른 알림 조건 설정
3. Slack, 이메일 등으로 알림 수신

### Datadog 모니터링

1. Datadog 대시보드에서 로그 기반 모니터 생성
2. 메트릭 추적 및 알림 설정
3. APM(Application Performance Monitoring) 연동

## 보안 고려사항

1. **민감 정보 제거**: 로그에 비밀번호, 토큰 등 민감 정보 포함 금지
2. **로그 접근 제어**: 로그 파일에 대한 접근 권한 제한
3. **로그 암호화**: 필요 시 로그 파일 암호화 저장

## 확장 가능성

현재 구현은 기본적인 기능을 제공하며, 필요에 따라 다음을 추가할 수 있습니다:

- 로그 샘플링 (대량 로그 처리 시)
- 로그 압축 및 아카이빙
- 실시간 로그 스트리밍
- 로그 검색 및 필터링 UI
- 사용자 정의 로깅 서비스 플러그인

