# 로컬 개발 환경 설정 가이드

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [데이터베이스 구동](#데이터베이스-구동)
3. [환경 변수 설정](#환경-변수-설정)
4. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
5. [시드 데이터 생성](#시드-데이터-생성)
6. [개발 서버 실행](#개발-서버-실행)

---

## 🔧 사전 준비사항

### 필요 도구

- Node.js 18 이상
- Docker 및 Docker Compose
- npm 또는 yarn

### 확인 사항

- [ ] Docker가 설치되어 있고 실행 중인지 확인
- [ ] 포트 5432가 사용 가능한지 확인 (PostgreSQL 기본 포트)

---

## 🐳 데이터베이스 구동

### 1. PostgreSQL 데이터베이스 실행

로컬 개발용 Docker Compose 파일을 사용하여 PostgreSQL만 실행합니다:

```bash
# 프로젝트 루트 디렉토리에서 실행
docker-compose -f docker-compose.dev.yml up -d
```

데이터베이스가 정상적으로 실행되었는지 확인:

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.dev.yml ps

# 로그 확인
docker-compose -f docker-compose.dev.yml logs postgres
```

### 2. 데이터베이스 중지

개발이 끝나면 데이터베이스를 중지할 수 있습니다:

```bash
# 데이터베이스 중지 (데이터는 유지됨)
docker-compose -f docker-compose.dev.yml stop

# 데이터베이스 중지 및 볼륨 삭제 (데이터 삭제)
docker-compose -f docker-compose.dev.yml down -v
```

---

## ⚙️ 환경 변수 설정

### 1. .env.local 파일 생성

프로젝트 루트에 `.env.local` 파일을 생성합니다:

```bash
# 프로젝트 루트 디렉토리에서 실행
cat > .env.local << 'EOF'
# 로컬 개발 환경 변수
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adhub?schema=public"
NEXTAUTH_SECRET="local-development-secret-key-minimum-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"
LOG_LEVEL="info"
EOF
```

또는 수동으로 `.env.local` 파일을 생성하고 다음 내용을 추가:

```env
# 로컬 개발 환경 변수
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adhub?schema=public"
NEXTAUTH_SECRET="local-development-secret-key-minimum-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"
LOG_LEVEL="info"
```

### 2. NEXTAUTH_SECRET 생성 (선택사항)

더 안전한 시크릿 키를 생성하려면:

```bash
# macOS/Linux
openssl rand -base64 32

# 생성된 값을 .env.local의 NEXTAUTH_SECRET에 사용
```

---

## 🗄️ 데이터베이스 마이그레이션

### 1. Prisma Client 생성

```bash
npm run prisma:generate
```

### 2. 데이터베이스 마이그레이션 실행

```bash
npm run prisma:migrate
```

또는 개발 중에는 다음 명령어를 사용할 수 있습니다:

```bash
# 마이그레이션 적용
npx prisma migrate deploy

# 또는 개발용 마이그레이션 (스키마 변경 시)
npx prisma migrate dev
```

---

## 🌱 시드 데이터 생성

초기 데이터(관리자 계정 등)를 생성합니다:

```bash
npm run prisma:seed
```

시드 데이터에는 기본 관리자 계정이 포함되어 있습니다:
- 로그인 ID: `admin`
- 비밀번호: `admin123` (변경 권장)

---

## 🚀 개발 서버 실행

### 1. 개발 서버 시작

```bash
npm run dev
```

서버가 시작되면 브라우저에서 `http://localhost:3000`으로 접속할 수 있습니다.

### 2. 로그인

시드 데이터로 생성된 관리자 계정으로 로그인:
- 로그인 ID: `admin`
- 비밀번호: `admin123`

---

## 🔍 문제 해결

### 데이터베이스 연결 오류

1. **PostgreSQL 컨테이너가 실행 중인지 확인:**
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

2. **포트 충돌 확인:**
   ```bash
   # 포트 5432가 사용 중인지 확인
   lsof -i :5432
   ```

3. **데이터베이스 로그 확인:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs postgres
   ```

### 마이그레이션 오류

1. **데이터베이스 초기화 (주의: 모든 데이터 삭제):**
   ```bash
   # 컨테이너와 볼륨 삭제
   docker-compose -f docker-compose.dev.yml down -v
   
   # 다시 시작
   docker-compose -f docker-compose.dev.yml up -d
   
   # 마이그레이션 재실행
   npm run prisma:migrate
   ```

### Prisma Client 오류

```bash
# Prisma Client 재생성
npm run prisma:generate
```

---

## 📝 빠른 시작 요약

```bash
# 1. 데이터베이스 실행
docker-compose -f docker-compose.dev.yml up -d

# 2. 환경 변수 설정 (.env.local 파일 생성)
# 위의 "환경 변수 설정" 섹션 참고

# 3. Prisma Client 생성
npm run prisma:generate

# 4. 마이그레이션 실행
npm run prisma:migrate

# 5. 시드 데이터 생성
npm run prisma:seed

# 6. 개발 서버 실행
npm run dev
```

---

## 🛑 개발 종료 시

```bash
# 개발 서버 중지: Ctrl + C

# 데이터베이스 중지 (선택사항)
docker-compose -f docker-compose.dev.yml stop
```


