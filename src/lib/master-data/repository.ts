import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { MasterDataCategory, MasterDataItem } from "@/types/master-data";

export async function fetchMasterDataItems(): Promise<
  Record<MasterDataCategory, MasterDataItem[]>
> {
  const records = await prisma.masterDataItem.findMany({
    orderBy: [{ category: "asc" }, { value: "asc" }],
  });

  return records.reduce<Record<MasterDataCategory, MasterDataItem[]>>(
    (acc, record) => {
      const category = record.category as MasterDataCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: record.id,
        category,
        value: record.value,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      });
      return acc;
    },
    {
      campaign: [],
      creative: [],
      channel: [],
      budgetAccount: [],
      department: [],
      agency: [],
    },
  );
}

export async function createMasterDataItem(params: {
  category: MasterDataCategory;
  value: string;
}): Promise<MasterDataItem> {
  const created = await prisma.masterDataItem.create({
    data: {
      category: params.category,
      value: params.value,
    },
  });

  return {
    id: created.id,
    category: created.category as MasterDataCategory,
    value: created.value,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateMasterDataItem(params: {
  id: string;
  value: string;
}): Promise<MasterDataItem> {
  const updated = await prisma.masterDataItem.update({
    where: { id: params.id },
    data: {
      value: params.value,
      updatedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    category: updated.category as MasterDataCategory,
    value: updated.value,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteMasterDataItem(id: string): Promise<void> {
  await prisma.masterDataItem.delete({
    where: { id },
  });
}

export async function ensureMasterDataValueExists(
  category: MasterDataCategory,
  value: string,
): Promise<void> {
  const count = await prisma.masterDataItem.count({
    where: {
      category,
      value,
    },
  });

  if (count === 0) {
    throw new Prisma.PrismaClientKnownRequestError("NOT_FOUND", {
      clientVersion: Prisma.prismaVersion.client,
      code: "P2025",
    });
  }
}
