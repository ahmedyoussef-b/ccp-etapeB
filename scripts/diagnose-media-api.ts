import { prisma } from '../src/lib/prisma';

async function diagnose() {
  console.log('[Diagnostic] Starting NexaFlow media API diagnostic...\n');

  try {
    console.log('1. Testing Prisma connection...');
    await prisma.$connect();
    console.log('   ✅ PostgreSQL connection OK\n');

    console.log('2. Checking MediaItem schema...');
    const count = await prisma.mediaItem.count();
    console.log(`   ✅ MediaItem count: ${count}\n`);

    console.log('3. Checking dataUrl nullability...');
    const sample = await prisma.mediaItem.findFirst({
      select: { id: true, dataUrl: true, title: true },
    });
    console.log(`   ✅ Sample: ${sample?.title} (dataUrl: ${sample?.dataUrl ?? 'null'})\n`);

    console.log('4. Testing getAllItems...');
    const items = await prisma.mediaItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tags: true },
      take: 5,
    });
    console.log(`   ✅ Fetched ${items.length} items\n`);

    console.log('5. Testing server-store-prisma...');
    const { getAllItems } = await import('../src/lib/images/server-store-prisma');
    const apiItems = await getAllItems();
    console.log(`   ✅ getAllItems returned ${apiItems.length} items\n`);

    console.log('6. Checking file system registry...');
    const fs = await import('fs');
    const path = await import('path');
    const { getMediaDir } = await import('../src/lib/images/server-store');
    const mediaDir = getMediaDir();
    console.log(`   Registry dir: ${mediaDir}`);
    console.log(`   Exists: ${fs.existsSync(mediaDir)}\n`);

    console.log('✅ Diagnostic complete - no obvious errors found');
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
