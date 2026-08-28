import { prisma } from "../src/lib/prisma";
import { writeItem, getItemDir } from "../src/lib/images/server-store";

interface MediaItemRecord {
  id: string;
  title: string;
  category: string;
  description: string | null;
  tags: string[];
  kind: string;
  mimeType: string;
  size: number;
  dataUrl: string | null;
  thumbnailDataUrl: string | null;
  geolocation: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function migrate() {
  console.log("[Migration] Starting media dataUrl migration...");

  const items = await prisma.mediaItem.findMany({
    where: { dataUrl: { not: null } },
    include: { tags: true },
  });

  console.log(`[Migration] Found ${items.length} items with dataUrl`);

  let migrated = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const record: MediaItemRecord = {
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        tags: item.tags.map((t) => t.tag),
        kind: item.kind,
        mimeType: item.mimeType,
        size: item.size,
        dataUrl: item.dataUrl,
        thumbnailDataUrl: item.thumbnailDataUrl,
        geolocation: item.geolocation,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };

      await writeItem(record as any);

      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { dataUrl: null },
      });

      migrated++;
      console.log(`[Migration] Migrated ${migrated}/${items.length}: ${item.title}`);
    } catch (error) {
      failed++;
      console.error(`[Migration] Failed to migrate ${item.id}:`, error);
    }
  }

  console.log(`[Migration] Complete. Migrated: ${migrated}, Failed: ${failed}`);
}

migrate()
  .catch((error) => {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
  });
