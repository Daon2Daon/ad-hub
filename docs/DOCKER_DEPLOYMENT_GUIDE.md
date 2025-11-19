# Synology NAS Docker 배포 가이드

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [Synology NAS Docker 설정](#synology-nas-docker-설정)
3. [프로젝트 파일 업로드](#프로젝트-파일-업로드)
4. [환경 변수 설정](#환경-변수-설정)
5. [Docker Compose 배포](#docker-compose-배포)
6. [초기 데이터 설정](#초기-데이터-설정)
7. [접속 확인](#접속-확인)
8. [문제 해결](#문제-해결)
9. [업데이트 및 유지보수](#업데이트-및-유지보수)

---

## 🔧 사전 준비사항

### 필요 도구 및 권한

- Synology NAS 관리자 권한
- Docker 패키지 설치 (DSM 7.0 이상 권장)
- SSH 접속 권한 (선택사항, 터미널 작업 시 필요)
- 프로젝트 소스 코드

### 확인 사항

- [ ] Docker 패키지가 설치되어 있고 실행 중인지 확인
- [ ] NAS의 IP 주소 확인 (예: `192.168.1.100`)
- [ ] 사용할 포트 번호 확인 (기본값: 애플리케이션 `5412`, PostgreSQL `6709`)
- [ ] 볼륨 마운트 경로 확인 (기본값: `/volume1/docker/ad-hub`)

---

## 🐳 Synology NAS Docker 설정

### 1. Docker 패키지 설치

1. **DSM 패키지 센터** 열기
2. **Docker** 검색 및 설치
3. 설치 완료 후 **Docker** 앱 실행

### 2. 네트워크 설정 확인

- Docker 네트워크는 자동으로 생성되므로 별도 설정 불필요
- `docker-compose.yml`에서 `adhub-network`가 자동 생성됩니다

### 3. 볼륨 경로 준비

**로컬 개발 환경:**
- Docker Compose가 자동으로 프로젝트 루트에 `postgres-database/` 폴더를 생성합니다.
- 별도 작업이 필요하지 않습니다.

**Synology NAS 환경:**
SSH 또는 File Station을 통해 다음 경로를 생성합니다:

```bash
# SSH 접속 시
sudo mkdir -p /volume1/docker/ad-hub/postgres-database
sudo chmod 755 /volume1/docker/ad-hub
```

**주의**: 
- 로컬 개발: `docker-compose.yml`의 `volumes` 설정이 `./postgres-database`로 되어 있어 프로젝트 루트에 자동 생성됩니다.
- Synology NAS: `docker-compose.yml`의 `volumes` 설정을 `/volume1/docker/ad-hub/postgres-database`로 변경하거나, 심볼릭 링크를 사용할 수 있습니다.

---

## 📦 프로젝트 파일 업로드

### 방법 1: File Station 사용 (권장)

#### tar 압축 파일 생성

로컬 개발 환경에서 프로젝트 루트 디렉토리로 이동한 후, 다음 명령어로 압축 파일을 생성합니다:

```bash
# 프로젝트 루트 디렉토리에서 실행
cd /path/to/ad-hub

# tar 압축 파일 생성 (불필요한 파일 제외)
tar -czf ad-hub.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.turbo' \
  --exclude='dist' \
  --exclude='out' \
  --exclude='coverage' \
  --exclude='.git' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='*.log' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  --exclude='._*' \
  --exclude='Thumbs.db' \
  --exclude='Desktop.ini' \
  --exclude='@eaDir' \
  --exclude='@Logfiles' \
  --exclude='.SynologyWorkingDirectory' \
  --exclude='#eaDir' \
  --exclude='.cursor' \
  --exclude='.npm-cache' \
  --exclude='.env' \
  --exclude='ad-hub.tar.gz' \
  --exclude='PaxHeader' \
  --no-xattrs \
  --format=ustar \
  .
```

**명령어 설명:**
- `-c`: 압축 파일 생성
- `-z`: gzip 압축 사용
- `-f`: 파일명 지정
- `--exclude`: 제외할 파일/폴더 지정
- `--no-xattrs`: 확장 속성 제외 (PaxHeader 폴더 생성 방지)
- `--format=ustar`: 호환성 높은 ustar 형식 사용
- `.`: 현재 디렉토리의 모든 파일 포함 (제외 목록 제외)

**⚠️ postgres-database 폴더 포함:**
- 위 명령어는 `postgres-database` 폴더를 포함합니다
- 이 폴더는 데이터베이스 데이터를 포함하므로 크기가 클 수 있습니다 (수백 MB ~ 수 GB)
- 데이터베이스 데이터를 포함하지 않으려면 `--exclude='postgres-database'` 옵션을 추가하세요
- **주의**: 기존 데이터베이스 데이터를 덮어쓸 수 있으므로, Synology NAS에서 압축 해제 시 주의하세요

**⚠️ PaxHeader 폴더 문제:**
- `PaxHeader`는 tar 파일의 확장 속성(extended attributes)을 저장하는 메타데이터입니다
- macOS에서 tar 파일을 생성할 때 자주 발생합니다
- `--no-xattrs` 옵션을 사용하면 확장 속성을 제외하여 이 문제를 방지할 수 있습니다
- 이미 생성된 tar 파일에서 `PaxHeader` 폴더가 나타나면 무시하거나 삭제해도 됩니다 (실제 프로젝트 파일에는 영향 없음)

**압축 파일 생성 후:**

1. **File Station** 열기
2. `/docker/ad-hub` 폴더 생성 (또는 원하는 경로)
3. `ad-hub.tar.gz` 파일을 File Station에 업로드
4. File Station에서 압축 파일을 우클릭 → **압축 해제** → `/docker/ad-hub` 선택
5. 압축 해제 완료 후 압축 파일 삭제 (선택사항)

**또는 수동으로 파일 업로드:**

필요한 파일들을 개별적으로 업로드할 수도 있습니다:
- `Dockerfile`
- `docker-compose.yml`
- `dockerignore`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `prisma/` 폴더 전체
- `src/` 폴더 전체
- `public/` 폴더 (있는 경우)
- 기타 설정 파일들

### 방법 2: Git Clone (SSH 사용)

```bash
# SSH 접속
ssh admin@[NAS_IP]

# 프로젝트 디렉토리로 이동
cd /volume1/docker

# Git 저장소 클론
git clone [저장소_URL] ad-hub

cd ad-hub
```

### 방법 3: SCP 사용

```bash
# 로컬에서 실행
scp -r ./ad-hub admin@[NAS_IP]:/volume1/docker/
```

---

## ⚙️ 환경 변수 설정

### 1. `.env` 파일 생성

프로젝트 루트 디렉토리(`/volume1/docker/ad-hub/`)에 `.env` 파일을 생성합니다.

**File Station 사용:**
1. File Station에서 `/docker/ad-hub` 폴더 열기
2. **생성** → **텍스트 파일 생성**
3. 파일명: `.env`

**SSH 사용:**
```bash
cd /volume1/docker/ad-hub
nano .env
```

### 2. 환경 변수 값 설정

`.env` 파일에 다음 내용을 입력합니다:

```env
# 데이터베이스 설정
DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@postgres:5432/adhub?schema=public"
POSTGRES_PASSWORD="[강력한_비밀번호_입력]"

# NextAuth 설정
NEXTAUTH_SECRET="[32자_이상의_랜덤_문자열]"
NEXTAUTH_URL="http://[NAS_IP]:5412"

# 환경 설정
NODE_ENV="production"

# 시드 데이터 설정 (선택사항)
SEED_ADMIN_LOGIN_ID="admin"
SEED_ADMIN_PASSWORD="admin123"
```

**중요 사항:**

1. **`POSTGRES_PASSWORD`**: PostgreSQL 데이터베이스 비밀번호 (강력한 비밀번호 사용 권장)
2. **`NEXTAUTH_SECRET`**: NextAuth 세션 암호화 키 (32자 이상의 랜덤 문자열)
   - 생성 방법: `openssl rand -base64 32`
3. **`NEXTAUTH_URL`**: 
   - 내부 네트워크: `http://[NAS_IP]:5412`
   - 도메인 사용 시: `https://yourdomain.com`
4. **`DATABASE_URL`**: 
   - 호스트명은 `postgres` (docker-compose.yml의 서비스명)
   - 비밀번호는 `POSTGRES_PASSWORD`와 동일하게 설정

### 3. 파일 권한 설정

```bash
# SSH 접속 시
chmod 600 /volume1/docker/ad-hub/.env
```

---

## 🚀 Docker Compose 배포

### Synology NAS 환경 설정 (필수)

Synology NAS에서 배포하기 전에 `docker-compose.yml` 파일의 volumes 경로를 수정해야 합니다:

1. **File Station** 또는 **SSH**로 `/volume1/docker/ad-hub/docker-compose.yml` 파일 열기
2. `postgres` 서비스의 `volumes` 섹션을 다음과 같이 수정:

```yaml
volumes:
  # 로컬 개발용 경로 주석 처리
  # - ./postgres-database:/var/lib/postgresql/data
  # Synology NAS 경로 사용
  - /volume1/docker/ad-hub/postgres-database:/var/lib/postgresql/data
```

3. 파일 저장

### 방법 1: Docker GUI 사용 (권장)

1. **Docker** 앱 열기
2. **컨테이너** 탭 선택
3. **프로젝트** → **생성** 클릭
4. **프로젝트 이름**: `ad-hub` 입력
5. **경로**: `/volume1/docker/ad-hub` 선택
6. **docker-compose.yml** 파일 선택
7. **생성** 클릭
8. 컨테이너가 자동으로 빌드되고 시작됩니다

### 방법 2: SSH 터미널 사용

```bash
# 프로젝트 디렉토리로 이동
cd /volume1/docker/ad-hub

# Docker Compose로 빌드 및 시작
docker compose up -d --build

# 로그 확인
docker compose logs -f
```

### 빌드 과정

빌드는 다음 단계로 진행됩니다:

1. **의존성 설치**: `npm ci` 실행
2. **Prisma Client 생성**: `npx prisma generate` 실행
3. **Next.js 빌드**: `npm run build` 실행
4. **이미지 생성**: 멀티 스테이지 빌드로 최적화된 이미지 생성

**예상 소요 시간**: 5-10분 (네트워크 속도에 따라 다름)

---

## 🌱 초기 데이터 설정

### 1. 데이터베이스 마이그레이션 확인

컨테이너 시작 시 자동으로 `npx prisma migrate deploy`가 실행됩니다.

수동으로 실행하려면:

```bash
# 컨테이너 내부에서 실행
docker exec -it adhub-app sh
npx prisma migrate deploy
exit
```

### 2. 초기 관리자 계정 생성

```bash
# 시드 데이터 실행
docker exec -it adhub-app npm run prisma:seed
```

또는 `.env` 파일에 `SEED_ADMIN_LOGIN_ID`와 `SEED_ADMIN_PASSWORD`가 설정되어 있다면 자동으로 생성됩니다.

**기본 관리자 계정:**
- 아이디: `admin` (또는 `.env`의 `SEED_ADMIN_LOGIN_ID`)
- 비밀번호: `admin123` (또는 `.env`의 `SEED_ADMIN_PASSWORD`)

**⚠️ 보안 주의**: 프로덕션 환경에서는 반드시 비밀번호를 변경하세요!

---

## ✅ 접속 확인

### 1. 컨테이너 상태 확인

**Docker GUI:**
- **컨테이너** 탭에서 `adhub-app`과 `ad-hub-postgres-database`가 **실행 중** 상태인지 확인

**SSH:**
```bash
docker compose ps
```

예상 출력:
```
NAME                        STATUS
adhub-app                   Up (healthy)
ad-hub-postgres-database    Up (healthy)
```

### 2. 로그 확인

```bash
# 애플리케이션 로그
docker compose logs app

# 데이터베이스 로그
docker compose logs postgres

# 전체 로그
docker compose logs -f
```

### 3. 웹 브라우저 접속

브라우저에서 다음 URL로 접속:

```
http://[NAS_IP]:5412
```

예시:
```
http://192.168.1.100:5412
```

### 4. 로그인 테스트

- **URL**: `http://[NAS_IP]:5412/login`
- **아이디**: `admin`
- **비밀번호**: `admin123` (또는 `.env`에 설정한 값)

로그인 성공 시 `/dashboard`로 리디렉션됩니다.

---

## 🆘 문제 해결

### 문제 1: 컨테이너가 시작되지 않음

**증상**: 컨테이너가 계속 재시작되거나 시작되지 않음

**해결 방법:**

1. **로그 확인**
   ```bash
   docker compose logs app
   ```

2. **환경 변수 확인**
   - `.env` 파일이 올바른 위치에 있는지 확인
   - 모든 필수 환경 변수가 설정되었는지 확인

3. **포트 충돌 확인**
   ```bash
   # 포트 사용 중인지 확인
   netstat -tuln | grep 5412
   netstat -tuln | grep 6709
   ```
   - 다른 서비스가 포트를 사용 중이면 `docker-compose.yml`에서 포트 번호 변경

### 문제 2: 데이터베이스 연결 실패

**증상**: `DATABASE_URL` 관련 에러 또는 데이터베이스 연결 실패

**해결 방법:**

1. **데이터베이스 컨테이너 상태 확인**
   ```bash
   docker compose ps postgres
   ```

2. **데이터베이스 로그 확인**
   ```bash
   docker compose logs postgres
   ```

3. **DATABASE_URL 확인**
   - 호스트명이 `postgres`인지 확인 (docker-compose.yml의 서비스명)
   - 비밀번호가 `POSTGRES_PASSWORD`와 일치하는지 확인

4. **데이터베이스 수동 연결 테스트**
   ```bash
   docker exec -it ad-hub-postgres-database psql -U postgres -d adhub
   ```

### 문제 3: 빌드 실패

**증상**: Docker 이미지 빌드 중 에러 발생

**해결 방법:**

1. **디스크 공간 확인**
   ```bash
   df -h
   ```
   - 최소 5GB 이상 여유 공간 필요

2. **Docker 빌드 캐시 삭제**
   ```bash
   docker compose build --no-cache
   ```

3. **로그 확인**
   ```bash
   docker compose build 2>&1 | tee build.log
   ```

### 문제 4: Prisma 마이그레이션 실패

**증상**: `prisma migrate deploy` 실행 시 에러

**해결 방법:**

1. **수동 마이그레이션 실행**
   ```bash
   docker exec -it adhub-app npx prisma migrate deploy
   ```

2. **Prisma 스키마 확인**
   ```bash
   docker exec -it adhub-app npx prisma validate
   ```

3. **데이터베이스 초기화 (주의: 데이터 삭제됨)**
   ```bash
   # 데이터베이스 컨테이너 재생성
   docker compose down postgres
   docker volume rm ad-hub_postgres-database  # 볼륨 이름 확인 필요
   docker compose up -d postgres
   ```

### 문제 5: 권한 오류

**증상**: 볼륨 마운트 시 권한 오류

**해결 방법:**

**로컬 개발 환경:**
```bash
# 프로젝트 루트의 postgres-database 폴더 권한 설정
sudo chown -R 999:999 ./postgres-database
sudo chmod -R 755 ./postgres-database
```

**Synology NAS 환경:**
```bash
# 볼륨 디렉토리 권한 설정
sudo chown -R 999:999 /volume1/docker/ad-hub/postgres-database
sudo chmod -R 755 /volume1/docker/ad-hub
```

### 문제 6: 포트 접속 불가

**증상**: 브라우저에서 접속이 안 됨

**해결 방법:**

1. **방화벽 설정 확인**
   - DSM **제어판** → **보안** → **방화벽**
   - 포트 `5412`와 `6709` 허용 규칙 추가

2. **컨테이너 포트 매핑 확인**
   ```bash
   docker compose ps
   ```
   - `0.0.0.0:5412->3000/tcp` 형태로 표시되어야 함

3. **네트워크 설정 확인**
   - Docker 네트워크가 올바르게 생성되었는지 확인

### 문제 7: PaxHeader 폴더가 생성됨

**증상**: tar 파일 압축 해제 후 `PaxHeader` 폴더가 나타남

**원인:**
- `PaxHeader`는 tar 파일의 확장 속성(extended attributes, xattr)을 저장하는 메타데이터입니다
- macOS에서 tar 파일을 생성할 때 자주 발생합니다
- 일부 tar 구현체가 확장 속성을 별도 파일로 저장합니다

**해결 방법:**

1. **무시하기 (권장)**
   - `PaxHeader` 폴더는 실제 프로젝트 파일에 영향을 주지 않습니다
   - 단순히 삭제하거나 무시해도 됩니다
   ```bash
   # 압축 해제 후 삭제
   rm -rf PaxHeader
   ```

2. **재생성 시 옵션 추가**
   - 다음 번 tar 파일 생성 시 `--no-xattrs` 옵션을 사용하세요
   ```bash
   tar -czf ad-hub.tar.gz \
     --no-xattrs \
     --format=ustar \
     [기타 옵션들...]
   ```

3. **압축 해제 시 제외**
   - tar 압축 해제 시 `PaxHeader`를 제외할 수 있습니다
   ```bash
   tar -xzf ad-hub.tar.gz --exclude='PaxHeader'
   ```

---

## 🔄 업데이트 및 유지보수

### 애플리케이션 업데이트

1. **새 버전 다운로드**
   ```bash
   cd /volume1/docker/ad-hub
   git pull  # Git 사용 시
   # 또는 새 파일 업로드
   ```

2. **컨테이너 재빌드 및 재시작**
   ```bash
   docker compose down
   docker compose up -d --build
   ```

3. **데이터베이스 마이그레이션 (필요 시)**
   ```bash
   docker exec -it adhub-app npx prisma migrate deploy
   ```

### 데이터베이스 백업

자세한 내용은 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)를 참조하세요.

**간단한 백업:**
```bash
# SQL 덤프 생성
docker exec ad-hub-postgres-database pg_dump -U postgres -F p --clean --if-exists adhub > backup_$(date +%Y%m%d).sql
```

### 로그 관리

**로그 확인:**
```bash
# 실시간 로그
docker compose logs -f app

# 최근 100줄
docker compose logs --tail=100 app
```

**로그 파일 저장:**
```bash
docker compose logs app > app_$(date +%Y%m%d).log
```

### 컨테이너 재시작

```bash
# 전체 재시작
docker compose restart

# 특정 서비스만 재시작
docker compose restart app
docker compose restart postgres
```

### 컨테이너 중지 및 시작

```bash
# 중지
docker compose stop

# 시작
docker compose start

# 완전히 제거 (주의: 데이터는 볼륨에 보존됨)
docker compose down
```

### 디스크 공간 관리

**사용하지 않는 이미지 삭제:**
```bash
docker image prune -a
```

**사용하지 않는 볼륨 삭제 (주의: 데이터 삭제됨):**
```bash
docker volume prune
```

---

## 📝 체크리스트

배포 완료 확인:

- [ ] Docker 패키지 설치 완료
- [ ] 프로젝트 파일 업로드 완료
- [ ] `.env` 파일 생성 및 설정 완료
- [ ] 볼륨 디렉토리 생성 완료
- [ ] Docker Compose 빌드 및 시작 완료
- [ ] 컨테이너 상태 확인 (healthy)
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 초기 관리자 계정 생성 완료
- [ ] 웹 브라우저 접속 성공
- [ ] 로그인 테스트 성공
- [ ] 방화벽 설정 완료 (필요 시)

---

## 🔒 보안 권장 사항

1. **환경 변수 보안**
   - `.env` 파일 권한: `600` (소유자만 읽기/쓰기)
   - Git에 `.env` 파일 커밋하지 않기

2. **비밀번호 정책**
   - 강력한 `POSTGRES_PASSWORD` 사용
   - 초기 관리자 비밀번호 변경
   - 정기적인 비밀번호 변경

3. **네트워크 보안**
   - 불필요한 포트 노출 방지
   - 방화벽 규칙 설정
   - HTTPS 사용 권장 (리버스 프록시 설정)

4. **정기 백업**
   - 데이터베이스 정기 백업
   - 백업 파일 암호화 저장

---

## 📚 추가 자료

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Synology Docker 가이드](https://kb.synology.com/ko-kr/DSM/help/Docker/docker_desc)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [Prisma 마이그레이션 가이드](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [서버 마이그레이션 가이드](./MIGRATION_GUIDE.md)

---

**마지막 업데이트**: 2025-01-15

