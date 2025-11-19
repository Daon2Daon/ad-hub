import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { verifyPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

const ADMIN_LOGIN_ID = process.env["SEED_ADMIN_LOGIN_ID"] ?? "admin";
const ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"] ?? "admin123";

async function main() {
  console.log("🔍 관리자 계정 확인 중...");
  console.log(`   아이디: ${ADMIN_LOGIN_ID}`);
  console.log(`   비밀번호: ${ADMIN_PASSWORD.replace(/./g, "*")}`);

  const user = await prisma.user.findUnique({
    where: { loginId: ADMIN_LOGIN_ID },
    include: { accessProfile: true },
  });

  if (!user) {
    console.error("❌ 관리자 계정을 찾을 수 없습니다!");
    console.error("   seed를 실행해주세요: npm run prisma:seed");
    process.exit(1);
  }

  console.log("\n📋 계정 정보:");
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Login ID: ${user.loginId}`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Name: ${user.name}`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - Status: ${user.status}`);
  console.log(`   - Password Hash: ${user.passwordHash ? "설정됨" : "❌ 없음"}`);
  console.log(`   - Access Profile: ${user.accessProfile ? "있음" : "❌ 없음"}`);

  if (!user.passwordHash) {
    console.error("\n❌ 비밀번호 해시가 설정되지 않았습니다!");
    process.exit(1);
  }

  if (user.role !== "admin") {
    console.error(`\n❌ 역할이 'admin'이 아닙니다. 현재: ${user.role}`);
    process.exit(1);
  }

  if (user.status !== "active") {
    console.error(`\n❌ 상태가 'active'가 아닙니다. 현재: ${user.status}`);
    process.exit(1);
  }

  console.log("\n🔐 비밀번호 검증 중...");
  const isValid = await verifyPassword(ADMIN_PASSWORD, user.passwordHash);

  if (isValid) {
    console.log("✅ 비밀번호 검증 성공!");
    console.log("\n✅ 관리자 계정이 올바르게 설정되어 있습니다.");
    console.log(`   로그인 가능: 아이디="${ADMIN_LOGIN_ID}", 비밀번호="${ADMIN_PASSWORD}"`);
  } else {
    console.error("❌ 비밀번호 검증 실패!");
    console.error("   저장된 비밀번호 해시와 입력한 비밀번호가 일치하지 않습니다.");
    console.error("   seed를 다시 실행해주세요: npm run prisma:seed");
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

