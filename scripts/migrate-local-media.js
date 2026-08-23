const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const LOCAL_DB_DIR = path.join(ROOT_DIR, '.local-db', 'images');
const DATA_REGISTRY_DIR = path.join(ROOT_DIR, '.data', 'registry');

const MIME_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/quicktime': 'mov',
};

function titleSlug(titleOrId) {
  return (titleOrId || 'media')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getExt(mimeType) {
  return MIME_TYPE_EXTENSIONS[mimeType] || 'jpg';
}

function sanitizeCategory(category) {
  if (!category) return 'sans-categorie';
  let cat = category.trim();
  if (cat.startsWith('registry/')) {
    cat = cat.slice('registry/'.length);
  } else if (cat === 'registry') {
    cat = '';
  }
  // Normaliser "ressources humaines/equipes/equipe B" vers "ressources humaines/equipe B" si "equipes" est en trop
  if (cat.includes('ressources humaines/equipes/equipe B')) {
    cat = cat.replace('ressources humaines/equipes/equipe B', 'ressources humaines/equipe B');
  }
  return cat;
}

function migrate() {
  console.log('=== Starting Migration from .local-db to .data/registry ===');
  let migratedCount = 0;
  const processedIds = new Set();

  // 1. From items.json if exists
  const itemsJsonPath = path.join(LOCAL_DB_DIR, 'items.json');
  if (fs.existsSync(itemsJsonPath)) {
    try {
      const items = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf8'));
      console.log(`Found ${items.length} items in items.json`);
      for (const item of items) {
        if (!item.id) continue;
        processedIds.add(item.id);
        const slug = titleSlug(item.title || item.id);
        const cat = sanitizeCategory(item.category);
        const segments = cat ? cat.split('/').filter(Boolean) : [];
        const targetDir = path.join(DATA_REGISTRY_DIR, ...segments, slug);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const ext = getExt(item.mimeType);
        const targetMediaFile = path.join(targetDir, `${slug}.${ext}`);
        const targetMetaFile = path.join(targetDir, `${slug}.json`);

        if (item.dataUrl) {
          const base64Data = item.dataUrl.replace(/^data:[^;]+;base64,/, '');
          fs.writeFileSync(targetMediaFile, Buffer.from(base64Data, 'base64'));
        }

        const { dataUrl, ...metaWithoutData } = item;
        fs.writeFileSync(targetMetaFile, JSON.stringify(metaWithoutData, null, 2), 'utf8');
        console.log(`Migrated item "${item.title}" -> ${targetDir}`);
        migratedCount++;
      }
    } catch (e) {
      console.error('Error parsing items.json:', e);
    }
  }

  // 2. Scan media folder for any individual metadata.json / metadata-*.json / media.* / data files
  const mediaDir = path.join(LOCAL_DB_DIR, 'media');
  if (fs.existsSync(mediaDir)) {
    function scanFolder(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFolder(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(fullPath, 'utf8');
            const meta = JSON.parse(raw);
            if (meta.title || meta.id) {
              const id = meta.id || `media_${Date.now()}`;
              if (processedIds.has(id)) continue;
              processedIds.add(id);

              const slug = titleSlug(meta.title || id);
              const cat = sanitizeCategory(meta.category);
              const segments = cat ? cat.split('/').filter(Boolean) : [];
              const targetDir = path.join(DATA_REGISTRY_DIR, ...segments, slug);

              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

              const ext = getExt(meta.mimeType);
              const targetMediaFile = path.join(targetDir, `${slug}.${ext}`);
              const targetMetaFile = path.join(targetDir, `${slug}.json`);

              // Check if media file exists in this directory
              const filesInDir = fs.readdirSync(dir);
              for (const f of filesInDir) {
                if (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp') || f === 'data' || f.startsWith('media.')) {
                  fs.copyFileSync(path.join(dir, f), targetMediaFile);
                  break;
                }
              }

              const { dataUrl, ...cleanMeta } = meta;
              cleanMeta.id = id;
              fs.writeFileSync(targetMetaFile, JSON.stringify(cleanMeta, null, 2), 'utf8');
              console.log(`Migrated folder item "${meta.title || id}" -> ${targetDir}`);
              migratedCount++;
            }
          } catch (e) {
            console.error('Error migrating file:', fullPath, e);
          }
        }
      }
    }

    scanFolder(mediaDir);
  }

  console.log(`=== Migration completed. Total migrated: ${migratedCount} ===`);
}

migrate();
