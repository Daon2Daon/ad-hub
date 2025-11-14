import type { Campaign } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CampaignRecord } from "@/types/dashboard";

export async function fetchCampaignRecords(): Promise<CampaignRecord[]> {
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
}
