# 의존성 설치 단계
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Prisma Client 생성 단계
FROM node:22-alpine AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

# 빌드 단계
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# [해결] Mac/Synology 쓰레기 파일 강제 삭제
RUN echo "🧹 Cleaning metadata files..." && \
    find . -name "PaxHeader" -exec rm -rf {} + && \
    find . -name "._*" -delete && \
    find . -name ".DS_Store" -delete

# public 폴더 생성
RUN mkdir -p public

# [추가] 빌드 타임 환경 변수 설정 (유효성 검사 통과용 가짜 값)
ENV DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
ENV NEXTAUTH_SECRET="this_is_a_very_long_dummy_secret_for_build_pass"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN npm run build

# ---------------------------------------------------
# [수정됨] 런타임 단계 (Runner)
# ---------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# [추가] PostgreSQL 클라이언트 설치 (pg_isready 사용을 위해)
RUN apk add --no-cache postgresql-client

# 1. 필수 파일 복사
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# [추가] seed 및 verify 스크립트 실행을 위해 필요한 파일 복사
# tsconfig.json: tsx가 path alias(@/)를 해석하기 위해 필요
# scripts/: verify-admin.ts 스크립트가 있음
# src/: seed.ts와 verify-admin.ts가 import하는 모듈들이 있음
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

# [추가] seed 실행을 위해 tsx 및 tsconfig-paths 설치 (devDependencies이지만 seed 실행에 필요)
# deps 단계에서 npm ci가 devDependencies도 설치하지만, 확실하게 하기 위해 로컬 설치
# NODE_ENV를 일시적으로 해제하여 devDependencies 설치 가능하도록 함
RUN NODE_ENV= npm install tsx tsconfig-paths --save-dev || echo "tsx 및 tsconfig-paths가 이미 설치되어 있습니다."

# 2. [추가] 자동화 스크립트(entrypoint.sh) 복사 및 권한 부여
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

# 3. [수정] 진입점(ENTRYPOINT) 설정
# 컨테이너가 시작될 때 entrypoint.sh를 무조건 먼저 실행합니다.
ENTRYPOINT ["entrypoint.sh"]

# 4. [수정] 앱 실행 명령
# entrypoint.sh가 모든 준비를 마친 후 이 명령어를 실행합니다.
CMD ["npm", "run", "start"]