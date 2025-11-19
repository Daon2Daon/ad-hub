#!/bin/sh

# 에러가 나면 즉시 멈춤 (안전장치)
set -e

echo "🚀 Starting Deployment..."

# 0. 데이터베이스 연결 대기
echo "⏳ Waiting for database to be ready..."

# DATABASE_URL에서 호스트와 포트 추출
# 형식: postgresql://user:password@host:port/database
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# 기본값 설정 (docker-compose.yml의 서비스 이름 사용)
if [ -z "$DB_HOST" ]; then
  DB_HOST="postgres"
fi
if [ -z "$DB_PORT" ]; then
  DB_PORT="5432"
fi

echo "📡 Connecting to database at $DB_HOST:$DB_PORT..."

# pg_isready를 사용하여 데이터베이스가 준비될 때까지 대기 (최대 60초)
MAX_WAIT=60
WAIT_COUNT=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres > /dev/null 2>&1; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ Database connection timeout after ${MAX_WAIT} seconds!"
    exit 1
  fi
  echo "⏳ Database is not ready yet. Waiting... ($WAIT_COUNT/$MAX_WAIT)"
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
done
echo "✅ Database is ready!"

# 1. Prisma Client 생성 (혹시 모르니 한 번 더)
echo "📦 Generating Prisma Client..."
npx prisma generate

# 2. 데이터베이스 마이그레이션 실행 (마이그레이션 파일 사용)
echo "🔄 Running database migrations..."
npx prisma migrate deploy || {
  echo "⚠️  Migration deploy failed, trying db push as fallback..."
  npx prisma db push || {
    echo "❌ Database schema setup failed!"
    exit 1
  }
}

# 3. 초기 데이터 시드 (관리자 계정 생성)
echo "🌱 Seeding database..."
set +e  # seed 실패해도 계속 진행
SEED_OUTPUT=$(npx prisma db seed 2>&1)
SEED_EXIT_CODE=$?
set -e  # 다시 에러 시 종료 모드로

if [ $SEED_EXIT_CODE -eq 0 ]; then
  echo "$SEED_OUTPUT"
  echo "✅ Seed completed successfully"
else
  echo "$SEED_OUTPUT"
  echo "⚠️  Seed 실행 중 오류가 발생했습니다. (Exit code: $SEED_EXIT_CODE)"
  echo "⚠️  관리자 계정이 생성되지 않았을 수 있습니다."
  echo "⚠️  수동으로 seed를 실행하거나 데이터베이스를 확인해주세요."
  # seed 실패가 치명적이지 않으므로 계속 진행
fi

# 3-1. 관리자 계정 검증 (선택적, 실패해도 계속 진행)
echo "🔍 관리자 계정 검증 중..."
set +e  # 검증 실패해도 계속 진행
VERIFY_OUTPUT=$(npm run verify:admin 2>&1)
VERIFY_EXIT_CODE=$?
set -e  # 다시 에러 시 종료 모드로

if [ $VERIFY_EXIT_CODE -eq 0 ]; then
  echo "$VERIFY_OUTPUT"
  echo "✅ 관리자 계정 검증 성공"
else
  echo "$VERIFY_OUTPUT"
  echo "⚠️  관리자 계정 검증 실패 - 로그를 확인해주세요"
  echo "⚠️  수동으로 확인: docker exec -it adhub-app npm run verify:admin"
  # 검증 실패가 치명적이지 않으므로 계속 진행
fi

# 4. 원래 실행하려던 명령(앱 시작) 실행
echo "✅ Starting Next.js App..."
exec "$@"