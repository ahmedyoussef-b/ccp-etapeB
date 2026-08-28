import fs from 'fs';
import path from 'path';

const MEDIA_DIR = path.join(process.cwd(), '.data', 'registry');

interface CleanupOptions {
  dryRun?: boolean;
  force?: boolean;
  since?: string;
}

interface CleanupStats {
  jsonFiles: number;
  binaryFiles: number;
  itemsToDelete: number;
  itemsKept: number;
  orphans: number;
  bytesFreed: number;
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') options.dryRun = true;
    if (args[i] === '--force') options.force = true;
    if (args[i] === '--since' && args[i + 1]) options.since = args[i + 1];
  }

  return options;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null;
let dbAvailable = false;

async function initDatabase(): Promise<boolean> {
  try {
    const { prisma: prismaClient } = await import('../src/lib/prisma');
    prisma = prismaClient;
    await prisma.$connect();
    dbAvailable = true;
    return true;
  } catch (error) {
    console.log(`⚠️ Base de données indisponible: ${error instanceof Error ? error.message : 'unknown'}`);
    dbAvailable = false;
    return false;
  }
}

async function getMediaItemCount(): Promise<number> {
  if (!dbAvailable || !prisma) return 0;
  try {
    return await prisma.mediaItem.count();
  } catch {
    return 0;
  }
}

async function findMediaItemByIdentifier(identifier: string): Promise<{ id: string; dataUrl: string | null } | null> {
  if (!dbAvailable || !prisma) return null;
  
  try {
    const item = await prisma.mediaItem.findFirst({
      where: {
        OR: [
          { id: identifier },
          { uuid: identifier },
        ],
      },
      select: { id: true, dataUrl: true },
    });

    return item;
  } catch {
    return null;
  }
}

function getSizeBytes(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function shouldDeleteFile(filePath: string, since?: string): boolean {
  if (!since) return true;
  
  try {
    const stats = fs.statSync(filePath);
    const sinceDate = new Date(since);
    return stats.mtime < sinceDate;
  } catch {
    return false;
  }
}

function isMediaJson(parsed: any): boolean {
  return !!(parsed.id || parsed.uuid) && !!parsed.mimeType;
}

async function cleanupRegistry(options: CleanupOptions): Promise<CleanupStats> {
  const stats: CleanupStats = {
    jsonFiles: 0,
    binaryFiles: 0,
    itemsToDelete: 0,
    itemsKept: 0,
    orphans: 0,
    bytesFreed: 0,
  };

  if (!fs.existsSync(MEDIA_DIR)) {
    console.log(`📁 Dossier .data/registry/ introuvable: ${MEDIA_DIR}`);
    return stats;
  }

  console.log(`📊 Analyse de .data/registry/`);
  console.log(`   Mode: ${options.dryRun ? 'DRY-RUN' : 'EXECUTION'}`);
  console.log(`   Depuis: ${options.since || 'toujours'}`);

  dbAvailable = await initDatabase();
  const totalWebItems = dbAvailable ? await getMediaItemCount() : 0;
  console.log(`   Items en base: ${totalWebItems}`);
  console.log(`   Base de données: ${dbAvailable ? '✅ disponible' : '⚠️ indisponible (mode dégradé)'}`);

  const filesToDelete: string[] = [];
  const dirsToCheck: string[] = [];

  async function scanDir(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
        dirsToCheck.push(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.json')) {
          stats.jsonFiles++;
          
          try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const parsed = JSON.parse(raw);
            
            if (!isMediaJson(parsed)) {
              continue;
            }

            const identifier = parsed.id || parsed.uuid;
            
            if (!identifier) {
              console.log(`   ⚠️ JSON sans id/uuid: ${fullPath}`);
              continue;
            }

            if (!shouldDeleteFile(fullPath, options.since)) {
              continue;
            }

            const item = await findMediaItemByIdentifier(identifier);
            
            if (!dbAvailable) {
              if (!options.dryRun) {
                console.log(`   ⚠️ Impossible de vérifier ${identifier}: base indisponible`);
              }
              continue;
            }

            if (!item) {
              stats.orphans++;
              filesToDelete.push(fullPath);
              const binaryPath = fullPath.replace(/\.json$/, '');
              if (fs.existsSync(binaryPath)) {
                stats.binaryFiles++;
                filesToDelete.push(binaryPath);
                stats.bytesFreed += getSizeBytes(binaryPath);
              }
              stats.bytesFreed += getSizeBytes(fullPath);
            } else if (item.dataUrl === null) {
              stats.itemsToDelete++;
              filesToDelete.push(fullPath);
              const binaryPath = fullPath.replace(/\.json$/, '');
              if (fs.existsSync(binaryPath)) {
                stats.binaryFiles++;
                filesToDelete.push(binaryPath);
                stats.bytesFreed += getSizeBytes(binaryPath);
              }
              stats.bytesFreed += getSizeBytes(fullPath);
            } else {
              stats.itemsKept++;
            }
          } catch (error) {
            console.error(`   ❌ Erreur lecture ${fullPath}:`, error);
          }
        }
      }
    }
  }

  await scanDir(MEDIA_DIR);

  console.log(`\n📁 Fichiers JSON trouvés: ${stats.jsonFiles}`);
  console.log(`📁 Fichiers binaires trouvés: ${stats.binaryFiles}`);
  console.log(`🔍 Items à supprimer: ${stats.itemsToDelete}`);
  console.log(`✅ Items à conserver: ${stats.itemsKept}`);
  console.log(`⚠️ Orphelins: ${stats.orphans}`);
  console.log(`💾 Espace libérable: ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);

  if (options.dryRun) {
    console.log(`\n🏁 DRY-RUN terminé. Aucun fichier supprimé.`);
    return stats;
  }

  if (!options.force) {
    console.log(`\n⚠️ Mode dry-run désactivé mais --force non spécifié.`);
    console.log(`   Utilisez --dry-run pour voir ce qui serait supprimé.`);
    console.log(`   Utilisez --force pour exécuter le cleanup.`);
    return stats;
  }

  if (!dbAvailable) {
    console.log(`\n❌ Impossible d'exécuter le cleanup sans accès à la base de données.`);
    console.log(`   Utilisez --dry-run pour analyser les fichiers.`);
    return stats;
  }

  console.log(`\n🧹 Nettoyage en cours...`);
  
  let deleted = 0;
  const batchSize = 100;
  
  for (let i = 0; i < filesToDelete.length; i += batchSize) {
    const batch = filesToDelete.slice(i, i + batchSize);
    
    for (const filePath of batch) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted++;
          console.log(`   ✅ Supprimé ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error(`   ❌ Erreur suppression ${filePath}:`, error);
      }
    }

    if (i + batchSize < filesToDelete.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  for (const dir of dirsToCheck) {
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        console.log(`   🗑️ Dossier vide supprimé: ${dir}`);
      }
    } catch {
      // Ignore
    }
  }

  console.log(`\n📊 Nettoyage terminé:`);
  console.log(`   ✅ Fichiers supprimés: ${deleted}`);
  console.log(`   💾 Espace libéré: ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
  
  return stats;
}

async function main() {
  const options = parseArgs();
  
  try {
    await cleanupRegistry(options);
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

main();
