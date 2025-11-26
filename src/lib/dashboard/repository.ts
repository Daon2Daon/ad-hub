import type { Campaign, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { UserAccessProfile } from "@/types/auth";
import type { CampaignRecord } from "@/types/dashboard";

export async function fetchCampaignRecords(profile?: UserAccessProfile): Promise<CampaignRecord[]> {
  const where = buildScopeWhere(profile);

  const campaigns = await prisma.campaign.findMany({
    where,
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

function buildScopeWhere(profile?: UserAccessProfile): Prisma.CampaignWhereInput | undefined {
  if (!profile || profile.role === "admin") {
    return undefined;
  }

  const conditions: Prisma.CampaignWhereInput[] = [];

  if (profile.scope.departments.length > 0) {
    conditions.push({ department: { in: profile.scope.departments } });
  }

  if (profile.scope.agencies.length > 0) {
    conditions.push({ agency: { in: profile.scope.agencies } });
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { AND: conditions };
}
