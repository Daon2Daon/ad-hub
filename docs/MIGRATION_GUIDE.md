# 서버 마이그레이션 가이드

서버를 이동할 때 기존 데이터를 그대로 옮기는 방법을 단계별로 안내합니다.

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [기존 서버에서 데이터 백업](#기존-서버에서-데이터-백업)
3. [새 서버에 데이터 복원](#새-서버에-데이터-복원)
4. [애플리케이션 배포](#애플리케이션-배포)
5. [검증 및 확인](#검증-및-확인)

---

## 🔧 사전 준비사항

### 필요 도구
- PostgreSQL 클라이언트 (`pg_dump`, `psql`) 또는 Docker
- 환경 변수 파일 (`.env`)
- 프로젝트 소스 코드

### 확인 사항
- 기존 서버의 데이터베이스 접근 정보
- 새 서버의 데이터베이스 접근 정보
- 네트워크 연결 상태 (서버 간 파일 전송 방법)

---

## 📦 기존 서버에서 데이터 백업

### 방법 1: Docker Compose를 사용하는 경우

#### 1-1. 데이터베이스 백업 (SQL 덤프 파일)

```bash
# 기존 서버에서 실행
cd /path/to/ad-hub

# Docker 컨테이너가 실행 중인지 확인
docker ps | grep postgres

# 데이터베이스 백업 (커스텀 형식)
docker exec adhub-database-postgres pg_dump -U postgres -F c -b -v -f "/tmp/ad-hub-backup.dump" adhub

# 백업 파일을 컨테이너에서 호스트로 복사
docker cp adhub-database-postgres:/tmp/ad-hub-backup.dump ./ad-hub-backup.dump

# 또는 SQL 형식으로 백업 (가독성 좋음)
docker exec adhub-database-postgres pg_dump -U postgres adhub > ad-hub-backup.sql
```

#### 1-2. 데이터베이스 백업 (플레인 SQL 형식 - 권장)

```bash
# 기존 서버에서 실행
docker exec adhub-database-postgres pg_dump -U postgres -F p --clean --if-exists adhub > ad-hub-backup.sql
```

**백업 파일 설명:**
- `-F p`: 플레인 텍스트 SQL 형식
- `--clean`: 기존 객체 삭제 명령 포함
- `--if-exists`: DROP 명령에 IF EXISTS 추가 (안전성)

#### 1-3. 환경 변수 백업

```bash
# .env 파일 백업 (민감한 정보 포함)
cp .env .env.backup

# 또는 환경 변수만 별도로 기록
cat > env-backup.txt << EOF
DATABASE_URL=<기존_데이터베이스_URL>
NEXTAUTH_SECRET=<기존_시크릿>
NEXTAUTH_URL=<기존_URL>
EOF
```

### 방법 2: PostgreSQL에 직접 접근하는 경우

```bash
# pg_dump로 백업
pg_dump -h <기존_호스트> -U postgres -d adhub -F p --clean --if-exists > ad-hub-backup.sql

# 또는 커스텀 형식 (압축됨)
pg_dump -h <기존_호스트> -U postgres -d adhub -F c -b -v -f ad-hub-backup.dump
```

### 방법 3: Docker 볼륨 직접 백업 (전체 데이터 디렉토리)

**⚠️ 중요: 이 방법은 PostgreSQL 데이터 디렉토리 전체를 그대로 복사하는 방식입니다.**

이 방법은 PostgreSQL의 내부 파일 구조를 그대로 복사하므로, 다음과 같은 조건이 필요합니다:
- PostgreSQL 버전이 동일해야 함 (권장)
- 서버 아키텍처가 동일해야 함 (예: 모두 x86_64 또는 모두 ARM64)
- Docker Compose의 볼륨 마운트 경로가 동일해야 함

**장점:**
- 가장 빠른 백업/복원 (파일 복사만 수행)
- PostgreSQL의 모든 내부 상태 보존 (트랜잭션 로그 등)

**단점:**
- PostgreSQL 버전 호환성 문제 가능
- 파일 시스템 호환성 고려 필요
- 백업 파일 크기가 큼

```bash
# Docker Compose 볼륨이 마운트된 디렉토리 백업
# docker-compose.yml의 volumes 경로 확인 필요
# 기존 서버에서 실행:

# 1. 데이터베이스 컨테이너 중지 (데이터 일관성 보장)
docker compose stop postgres

# 2. 데이터 디렉토리 전체 백업
tar -czf postgres-data-backup.tar.gz /volume1/docker/ad-hub/postgres-database

# 3. 컨테이너 재시작
docker compose start postgres
```

**⚠️ 주의:** 데이터베이스를 중지하지 않고 백업하면 데이터 불일치가 발생할 수 있습니다.

---

## 🚀 새 서버에 데이터 복원

### 새 서버 준비

#### 1. 프로젝트 소스 코드 복사

```bash
# 새 서버에서
cd /path/to
git clone <프로젝트_저장소_URL> ad-hub
# 또는
scp -r user@old-server:/path/to/ad-hub ./

cd ad-hub
```

#### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집
nano .env
```

`.env` 파일에 새 서버의 정보 입력:
```env
DATABASE_URL="postgresql://postgres:새_비밀번호@localhost:5412/adhub?schema=public"
NEXTAUTH_SECRET="32자_이상의_랜덤_문자열_또는_기존_값_재사용"
NEXTAUTH_URL="https://새_서버_도메인"
NODE_ENV="production"
```

**중요:** `NEXTAUTH_SECRET`은 기존 값을 그대로 사용하거나 새로운 값으로 변경할 수 있습니다.
- **기존 값 사용**: 기존 세션이 유지됩니다 (사용자 재로그인 불필요)
- **새 값 사용**: 모든 세션이 무효화됩니다 (사용자 재로그인 필요)

#### 3. 의존성 설치

```bash
npm install
# 또는
npm ci  # package-lock.json 기반 정확한 버전 설치
```

### 방법 1: Docker Compose를 사용하는 경우

#### 1-1. 데이터베이스 컨테이너 실행

```bash
# docker-compose.yml 확인 및 필요시 수정
nano docker-compose.yml

# 데이터베이스 컨테이너 시작 (애플리케이션 없이)
docker compose up -d postgres

# 데이터베이스가 준비될 때까지 대기
docker compose logs -f postgres
# "database system is ready to accept connections" 메시지 확인
```

#### 1-2. Prisma 마이그레이션 적용

```bash
# Prisma 클라이언트 생성
npm run prisma:generate

# 마이그레이션 적용 (스키마 생성)
npm run prisma:migrate
# 또는
npx prisma migrate deploy
```

**주의:** 백업된 데이터에 모든 테이블이 이미 있다면, 마이그레이션은 스킵될 수 있습니다.

#### 1-3. 데이터 복원

```bash
# 방법 A: SQL 파일로 복원 (권장)
cat ad-hub-backup.sql | docker exec -i adhub-database-postgres psql -U postgres -d adhub

# 방법 B: 커스텀 덤프 파일로 복원
docker cp ad-hub-backup.dump adhub-database-postgres:/tmp/
docker exec adhub-database-postgres pg_restore -U postgres -d adhub -v --clean --if-exists /tmp/ad-hub-backup.dump

# 방법 C: 복원 후 권한 확인
docker exec -it adhub-database-postgres psql -U postgres -d adhub -c "\dt"
```

### 방법 2: PostgreSQL에 직접 접근하는 경우

```bash
# 데이터베이스 생성
createdb -h <새_호스트> -U postgres adhub

# 데이터 복원
psql -h <새_호스트> -U postgres -d adhub < ad-hub-backup.sql

# 또는 커스텀 덤프
pg_restore -h <새_호스트> -U postgres -d adhub -v --clean --if-exists ad-hub-backup.dump
```

### 방법 3: Docker 볼륨 직접 복원

**⚠️ 중요: 이 방법은 PostgreSQL 데이터 디렉토리 전체를 그대로 복원하는 방식입니다.**

**복원 전 확인사항:**
- 기존 서버와 새 서버의 PostgreSQL 버전이 동일한지 확인
- 기존 서버와 새 서버의 아키텍처가 동일한지 확인
- `docker-compose.yml`의 볼륨 마운트 경로가 동일한지 확인

```bash
# 새 서버에서 실행:

# 1. 데이터베이스 컨테이너가 실행 중이면 중지
docker compose down postgres

# 2. 기존 데이터 디렉토리 삭제 (있는 경우)
# 주의: 이 명령은 기존 데이터를 완전히 삭제합니다!
rm -rf /volume1/docker/ad-hub/postgres-database

# 3. 백업된 데이터 디렉토리 복원
tar -xzf postgres-data-backup.tar.gz -C /

# 4. 디렉토리 권한 설정 (PostgreSQL이 읽을 수 있도록)
chown -R 999:999 /volume1/docker/ad-hub/postgres-database
# 또는 (사용자에 따라)
chmod -R 700 /volume1/docker/ad-hub/postgres-database

# 5. Docker Compose 재시작
docker compose up -d postgres

# 6. 로그 확인 (정상 시작 확인)
docker compose logs -f postgres
```

**⚠️ 주의사항:**
- 데이터 디렉토리를 복원한 후, 컨테이너를 시작할 때 PostgreSQL 버전이 동일해야 합니다.
- 파일 권한 문제가 발생할 수 있으므로, `chown` 또는 `chmod` 명령으로 권한을 조정해야 할 수 있습니다.
- 복원 후 데이터베이스에 접속하여 데이터 무결성을 확인하세요.

---

## 🚀 애플리케이션 배포

### 1. Prisma 클라이언트 생성

```bash
npm run prisma:generate
```

### 2. 애플리케이션 빌드

```bash
npm run build
```

### 3. 애플리케이션 시작

#### 프로덕션 모드 (PM2 사용 예시)

```bash
# PM2 설치 (없는 경우)
npm install -g pm2

# 애플리케이션 시작
pm2 start npm --name "ad-hub" -- start

# 또는 직접 실행
npm start
```

#### Docker Compose로 전체 실행

```bash
# docker-compose.yml에 app 서비스 추가 후
docker compose up -d
```

---

## ✅ 검증 및 확인

### 1. 데이터베이스 연결 확인

```bash
# PostgreSQL에 접속하여 테이블 확인
docker exec -it adhub-database-postgres psql -U postgres -d adhub

# 데이터베이스 내부에서:
\dt                    # 테이블 목록 확인
SELECT COUNT(*) FROM "User";     # 사용자 수 확인
SELECT COUNT(*) FROM "Campaign"; # 캠페인 수 확인
\q                     # 종료
```

### 2. 애플리케이션 동작 확인

```bash
# 로그 확인
docker compose logs -f
# 또는
pm2 logs ad-hub

# 브라우저에서 접속 테스트
# https://새_서버_도메인
```

### 3. 데이터 무결성 검증

```bash
# 사용자 데이터 확인
docker exec adhub-database-postgres psql -U postgres -d adhub -c "SELECT id, \"loginId\", email, role, status FROM \"User\";"

# 캠페인 데이터 확인
docker exec adhub-database-postgres psql -U postgres -d adhub -c "SELECT COUNT(*) as total_campaigns FROM \"Campaign\";"

# 활동 로그 확인
docker exec adhub-database-postgres psql -U postgres -d adhub -c "SELECT COUNT(*) as total_logs FROM \"ActivityLog\";"
```

---

## 🔒 보안 확인사항

### 마이그레이션 후 필수 확인

1. **환경 변수 보안**
   - `.env` 파일이 Git에 커밋되지 않았는지 확인
   - 새 서버의 `.env` 파일 권한 설정: `chmod 600 .env`

2. **데이터베이스 접근 제어**
   - 새 서버의 방화벽 설정 확인
   - 데이터베이스 포트가 외부에 노출되지 않도록 설정

3. **NEXTAUTH_SECRET 확인**
   - 기존 값 사용 시: 세션 유지됨
   - 새 값 사용 시: 모든 사용자 재로그인 필요

---

## 🆘 문제 해결

### 백업/복원 중 오류 발생 시

#### 오류: "database does not exist"
```bash
# 데이터베이스 먼저 생성
docker exec -it adhub-database-postgres psql -U postgres -c "CREATE DATABASE adhub;"
```

#### 오류: "permission denied"
```bash
# 백업 파일 권한 확인
chmod 644 ad-hub-backup.sql

# 또는 Docker를 사용하여 백업 파일 권한 문제 우회
docker cp ad-hub-backup.sql adhub-database-postgres:/tmp/
docker exec adhub-database-postgres psql -U postgres -d adhub -f /tmp/ad-hub-backup.sql
```

#### 오류: "relation already exists"
```bash
# --clean 옵션으로 백업한 경우 자동 처리됨
# 수동으로 삭제해야 하는 경우:
docker exec -it adhub-database-postgres psql -U postgres -d adhub -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# 그 후 다시 복원
```

### 마이그레이션 후 애플리케이션 오류

```bash
# Prisma 클라이언트 재생성
npm run prisma:generate

# 마이그레이션 상태 확인
npx prisma migrate status

# 필요시 마이그레이션 재적용
npx prisma migrate deploy
```

---

## 📝 체크리스트

마이그레이션 완료 확인:

- [ ] 기존 서버에서 데이터베이스 백업 완료
- [ ] 환경 변수 파일 백업 완료
- [ ] 새 서버에 프로젝트 소스 코드 복사 완료
- [ ] 새 서버에 `.env` 파일 설정 완료
- [ ] 새 서버에 데이터베이스 컨테이너 실행 완료
- [ ] Prisma 마이그레이션 적용 완료
- [ ] 데이터 복원 완료
- [ ] 데이터 무결성 확인 완료
- [ ] 애플리케이션 빌드 및 실행 완료
- [ ] 애플리케이션 동작 확인 완료
- [ ] 로그인 테스트 완료
- [ ] 보안 설정 확인 완료

---

## 📚 추가 자료

- [PostgreSQL 백업 및 복원 공식 문서](https://www.postgresql.org/docs/current/backup-dump.html)
- [Prisma 마이그레이션 가이드](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Docker Compose 문서](https://docs.docker.com/compose/)

---

**마지막 업데이트:** 2025-01-15

