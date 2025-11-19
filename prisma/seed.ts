import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

const ADMIN_LOGIN_ID = process.env["SEED_ADMIN_LOGIN_ID"] ?? "admin";
const ADMIN_EMAIL = process.env["SEED_ADMIN_EMAIL"] ?? "admin@adhub.local";
const ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"] ?? "admin123";
const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "시스템 관리자";

async function main() {
  console.info("🚀 [seed] 데이터베이스 시딩을 시작합니다.");
  console.info(`👤 [seed] 대상 관리자 ID: ${ADMIN_LOGIN_ID}`);

  // 1. 비밀번호 해싱 (항상 수행)
  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  // 2. 관리자 계정 Upsert (없으면 생성, 있으면 정보 갱신)
  // 핵심: 시딩을 돌릴 때마다 패스워드를 재설정하여 .env와 동기화합니다.
  const adminUser = await prisma.user.upsert({
    where: { loginId: ADMIN_LOGIN_ID },
    update: {
      passwordHash: hashedPassword, // [중요] 비밀번호 강제 업데이트
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin",
      status: "active",
    },
    create: {
      loginId: ADMIN_LOGIN_ID,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash: hashedPassword,
      role: "admin",
      status: "active",
    },
  });

  console.info(`✅ [seed] 관리자 계정 처리 완료 (ID: ${adminUser.id})`);

  // 3. 권한 프로필(Access Profile) 설정
  const defaultProfile = createDefaultAccessProfile("admin");
  
  await prisma.userAccessProfile.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      columnPermissions: defaultProfile.columnPermissions,
      departments: defaultProfile.scope.departments,
      agencies: defaultProfile.scope.agencies,
    },
    update: {
      columnPermissions: defaultProfile.columnPermissions,
      departments: defaultProfile.scope.departments,
      agencies: defaultProfile.scope.agencies,
    },
  });
  
  console.info("✅ [seed] 권한 프로필 설정 완료");

  // 4. 비밀번호 검증 테스트 (자가 진단)
  console.info("🔍 [seed] 로그인 테스트를 수행합니다...");
  if (adminUser.passwordHash) {
    const passwordValid = await verifyPassword(ADMIN_PASSWORD, adminUser.passwordHash);
    if (passwordValid) {
      console.info(`✨ [seed] 테스트 성공: '${ADMIN_PASSWORD}' 비밀번호로 로그인 가능합니다.`);
    } else {
      console.error("❌ [seed] 치명적 오류: 비밀번호 검증 실패. 해싱 로직을 확인하세요.");
      throw new Error("비밀번호 검증 실패");
    }
  }

  // 5. 샘플 데이터 생성 (기존 로직 유지)
  const campaignCount = await prisma.campaign.count();

  if (campaignCount === 0) {
    console.info("📦 [seed] 샘플 캠페인 데이터를 추가합니다...");

    const sampleCampaigns = [
      {
        campaign: "봄 시즌 프로모션",
        creative: "배너A",
        channel: "디스플레이",
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        spend: new Prisma.Decimal(1_200_000),
        budgetAccount: "BA-1001",
        department: "A부서",
        agency: "A대행사",
      },
      {
        campaign: "여름 한정 이벤트",
        creative: "배너B",
        channel: "SNS",
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
        spend: new Prisma.Decimal(800_000),
        budgetAccount: "BA-1002",
        department: "B부서",
        agency: "B대행사",
      },
      {
        campaign: "리마인드 캠페인",
        creative: "동영상A",
        channel: "동영상",
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
        spend: new Prisma.Decimal(450_000),
        budgetAccount: "BA-1001",
        department: "A부서",
        agency: "A대행사",
      },
      {
        campaign: "신제품 런칭",
        creative: "배너C",
        channel: "디스플레이",
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
        spend: new Prisma.Decimal(1_500_000),
        budgetAccount: "BA-1003",
        department: "C부서",
        agency: "A대행사",
      },
      {
        campaign: "브랜드 캠페인",
        creative: "배너A",
        channel: "검색",
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
        spend: new Prisma.Decimal(600_000),
        budgetAccount: "BA-1004",
        department: "A부서",
        agency: "C대행사",
      },
    ];

    await prisma.campaign.createMany({
      data: sampleCampaigns.map((item) => ({
        ...item,
        ownerId: adminUser.id,
      })),
    });
    console.info("✅ [seed] 샘플 데이터 추가 완료");
  } else {
    console.info("ℹ️ [seed] 기존 캠페인 데이터가 존재하여 샘플 추가를 건너뜁니다.");
  }
}

main()
  .catch((error) => {
    console.error("❌ [seed] 스크립트 실행 중 오류 발생:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });