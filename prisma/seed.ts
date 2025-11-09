import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";

import { createDefaultAccessProfile } from "@/lib/auth/profile";
import { hashPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

const ADMIN_LOGIN_ID = process.env["SEED_ADMIN_LOGIN_ID"] ?? "admin";
const ADMIN_EMAIL = process.env["SEED_ADMIN_EMAIL"] ?? "admin@adhub.local";
const ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"] ?? "admin123";
const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "시스템 관리자";

async function main() {
  console.info("[seed] 시작: 관리자 계정을 확인합니다.");

  const existingUser = await prisma.user.findUnique({
    where: { loginId: ADMIN_LOGIN_ID },
  });

  const adminUser =
    existingUser ??
    (await (async () => {
      const hashedPassword = await hashPassword(ADMIN_PASSWORD);
      const defaultProfile = createDefaultAccessProfile("admin");

      const created = await prisma.user.create({
        data: {
          loginId: ADMIN_LOGIN_ID,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          passwordHash: hashedPassword,
          role: "admin",
          status: "active",
          accessProfile: {
            create: {
              columnPermissions: defaultProfile.columnPermissions,
              departments: defaultProfile.scope.departments,
              agencies: defaultProfile.scope.agencies,
            },
          },
        },
      });

      console.info("[seed] 관리자 계정을 생성했습니다.");
      console.info(`[seed] 아이디: ${ADMIN_LOGIN_ID}`);
      console.info(`[seed] 이메일: ${ADMIN_EMAIL}`);
      console.info("[seed] 기본 비밀번호는 .env 설정을 참고하세요.");

      return created;
    })());

  const campaignCount = await prisma.campaign.count();

  if (campaignCount === 0) {
    console.info("[seed] 샘플 캠페인 데이터를 추가합니다.");

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

    console.info("[seed] 샘플 캠페인 데이터를 추가했습니다.");
  } else {
    console.info("[seed] 기존 캠페인 데이터가 존재하여 추가 시드를 건너뜁니다.");
  }
}

main()
  .catch((error) => {
    console.error("[seed] 오류 발생:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

