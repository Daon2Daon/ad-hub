import { Prisma } from "@prisma/client";
import type { Campaign } from "@prisma/client";

import { logger } from "@/lib/logs/logger";
import { prisma } from "@/lib/prisma";
import type { CampaignRecord } from "@/types/dashboard";

export async function fetchCampaignRecords(): Promise<CampaignRecord[]> {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: [{ startDate: "asc" }],
    });

    return campaigns.map(
      (campaign: Campaign): CampaignRecord => ({
      id: campaign.id,
      campaign: campaign.campaign,
      creative: campaign.creative,
      channel: campaign.channel,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      spend: Number(campaign.spend),
      budgetAccount: campaign.budgetAccount,
      department: campaign.department,
      agency: campaign.agency,
    }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      logger.warn(
        "데이터베이스 테이블이 존재하지 않습니다. 'npx prisma migrate deploy' 및 'npm run prisma:seed'를 실행하여 데이터베이스를 설정해주세요.",
        {
          code: error.code,
          meta: error.meta,
        },
      );
      return [];
    }
    throw error;
  }
}
