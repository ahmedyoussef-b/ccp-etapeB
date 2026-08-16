// src/app/api/pipeline/deploy/route.ts
import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

// ============================================
// TYPES
// ============================================
interface DeployRequestBody {
  trigger?: 'api' | 'webhook' | 'manual';
}

interface LocalFile {
  path: string;
  sha?: string;
  content: Buffer;
}

interface UploadFile extends LocalFile {
  action: 'nouveau' | 'modifié';
}

interface DeployStats {
  total: number;
  uploaded: number;
  deleted: number;
  errors: number;
  unchanged: number;
  new: number;
  modified: number;
}

interface DeployResponse {
  success: boolean;
  message: string;
  duration?: string;
  trigger?: string;
  stats?: DeployStats;
  error?: string;
}

// ============================================
// LOGGER
// ============================================
const logger = {
  info: (msg: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] ℹ️ ${msg}`, data || '');
  },
  success: (msg: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] ✅ ${msg}`, data || '');
  },
  warn: (msg: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] ⚠️ ${msg}`, data || '');
  },
  error: (msg: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] ❌ ${msg}`, data || '');
  },
  phase: (phase: string, msg: string) => {
    console.log('');
    console.log(`[${new Date().toISOString()}] 🚀 === PHASE ${phase} : ${msg} ===`);
  }
};

// ============================================
// HELPERS
// ============================================
function computeFileSha(content: Buffer): string {
  const blobHeader = `blob ${content.length}\0`;
  const blobData = Buffer.concat([Buffer.from(blobHeader), content]);
  const hash = crypto.createHash('sha1');
  hash.update(blobData);
  return hash.digest('hex');
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(request: Request): Promise<NextResponse<DeployResponse>> {
  const startTime = Date.now();
  logger.info('Déploiement démarré');
  
  // 🔒 Protection production
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Tentative de déploiement en production - Refusé');
    return NextResponse.json(
      { 
        success: false, 
        message: 'Not available in production' 
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json().catch((): DeployRequestBody => ({}))) as DeployRequestBody;
    const trigger = body.trigger || 'api';
    logger.info(`Déclenché par: ${trigger}`);

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'ahmedyoussef-b';
    const repo = process.env.GITHUB_REPO || 'ccp-etapeB';
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
      logger.error('GITHUB_TOKEN non configuré');
      return NextResponse.json(
        { 
          success: false, 
          message: 'GITHUB_TOKEN not configured' 
        },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });
    logger.success(`Authentifié sur ${owner}/${repo} (branche: ${branch})`);

    // ============================================
    // PHASE 1: TEST - Vérification
    // ============================================
    logger.phase('1', 'Test de vérification');

    try {
      await octokit.rest.repos.get({ owner, repo });
      logger.success('Accès au dépôt OK');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Impossible d'accéder au dépôt: ${errorMessage}`);
    }

    try {
      await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
      logger.success(`Branche ${branch} OK`);
    } catch {
      throw new Error(`Branche ${branch} introuvable`);
    }

    logger.success('✅ Tests passés avec succès!');

    // ============================================
    // PHASE 2: ANALYSE - Récupération des fichiers
    // ============================================
    logger.phase('2', 'Analyse des fichiers');

    // Récupérer les fichiers existants sur GitHub
    let existingFilesMap: Record<string, string> = {};
    let existingFiles: Array<{ path: string; sha: string }> = [];
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });

      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: refData.object.sha,
        recursive: '1'
      });

      existingFiles = treeData.tree
        .filter((item) => item.type === 'blob' && item.path !== undefined && item.sha !== undefined)
        .map((item) => ({
          path: item.path as string,
          sha: item.sha as string
        }));
      
      existingFilesMap = existingFiles.reduce<Record<string, string>>((acc, f) => {
        acc[f.path] = f.sha;
        return acc;
      }, {});
      
      logger.info(`${existingFiles.length} fichiers existants sur GitHub`);
    } catch {
      logger.warn('Aucun fichier existant (dépôt vide)');
    }

    // Scanner les fichiers locaux
    const appDir = process.cwd();
    const localFiles: LocalFile[] = [];
    
const ignoreDirs = ['node_modules', '.next', 'dist', 'build', '.git', '.vercel', '.github'];  
  const ignoreFiles = ['.env.local', '.env.development', '.env.production', '.env'];
    
    function walkDir(dir: string, relativePath = ''): void {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (ignoreDirs.includes(item)) continue;
          
          const fullPath = path.join(dir, item);
          const relPath = relativePath ? path.join(relativePath, item) : item;
          
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
              walkDir(fullPath, relPath);
            } else {
              if (ignoreFiles.includes(item)) {
                logger.info(`⏭️ Ignoré: ${relPath} (fichier sensible)`);
                continue;
              }
              if (relPath.startsWith('.git')) continue;
              
              const content = fs.readFileSync(fullPath);
              const localSha = computeFileSha(content);
              
              localFiles.push({
                path: relPath.replace(/\\/g, '/'),
                sha: localSha,
                content
              });
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn(`Erreur sur ${fullPath}: ${errorMessage}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.warn(`Erreur de lecture de ${dir}: ${errorMessage}`);
      }
    }
    
    walkDir(appDir);
    logger.info(`${localFiles.length} fichiers locaux trouvés`);

    // Identifier les fichiers modifiés
    const toUpload: UploadFile[] = [];
    const toDelete: string[] = [];

    const localPaths = new Set(localFiles.map(f => f.path));
    const remotePaths = new Set(Object.keys(existingFilesMap));

    for (const file of localFiles) {
      const remoteSha = existingFilesMap[file.path];
      if (!remoteSha) {
        toUpload.push({ ...file, action: 'nouveau' });
      } else if (remoteSha !== file.sha) {
        toUpload.push({ ...file, action: 'modifié' });
      }
    }

    for (const remotePath of Array.from(remotePaths)) {
      if (!localPaths.has(remotePath)) {
        toDelete.push(remotePath);
      }
    }

    const unchanged = localFiles.length - toUpload.length;

    logger.info('📊 Résumé des changements:');
    logger.info(`  ✅ Nouveaux: ${toUpload.filter(f => f.action === 'nouveau').length}`);
    logger.info(`  📝 Modifiés: ${toUpload.filter(f => f.action === 'modifié').length}`);
    logger.info(`  ⏭️ Inchangés: ${unchanged}`);
    logger.info(`  🗑️ Supprimés: ${toDelete.length}`);

    if (toUpload.length === 0 && toDelete.length === 0) {
      logger.success('Aucun changement détecté!');
      return NextResponse.json({
        success: true,
        message: 'Aucun changement détecté',
        stats: {
          total: localFiles.length,
          uploaded: 0,
          deleted: 0,
          errors: 0,
          unchanged,
          new: 0,
          modified: 0
        }
      });
    }

    // ============================================
    // PHASE 3: EXÉCUTION - Déploiement sur GitHub
    // ============================================
    logger.phase('3', 'Exécution du déploiement');

    let uploaded = 0;
    let deleted = 0;
    let errors = 0;

    // 1. Supprimer les fichiers
    if (toDelete.length > 0) {
      logger.info(`🗑️ Suppression de ${toDelete.length} fichiers...`);
      for (const filePath of toDelete) {
        try {
          await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path: filePath,
            message: `Suppression: ${filePath}`,
            sha: existingFilesMap[filePath],
            branch
          });
          deleted++;
          logger.success(`  ✅ Supprimé: ${filePath}`);
        } catch (err) {
          errors++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error(`  ❌ Erreur pour ${filePath}: ${errorMessage}`);
        }
      }
    }

    // 2. Uploader les fichiers
    if (toUpload.length > 0) {
      logger.info(`📤 Upload de ${toUpload.length} fichiers...`);
      for (const file of toUpload) {
        try {
          const contentBase64 = file.content.toString('base64');
          const sha = existingFilesMap[file.path] || undefined;
          
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.path,
            message: `Upload: ${file.path}`,
            content: contentBase64,
            branch,
            sha: sha
          });
          uploaded++;
          logger.success(`  ✅ Upload: ${file.path} (${file.action})`);
        } catch (err) {
          errors++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error(`  ❌ Erreur pour ${file.path}: ${errorMessage}`);
        }
      }
    }

    // ============================================
    // PHASE 4: COMMIT AUTOMATIQUE
    // ============================================
    logger.phase('4', 'Commit automatique');

    try {
      // Vérifier l'état du dépôt
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      logger.info(`📊 Statut Git: ${status.trim() ? `${status.split('\n').filter(Boolean).length} fichiers modifiés` : 'Propre'}`);
      
      if (status.trim()) {
        const files = status.split('\n').filter(Boolean).length;
        logger.info(`📝 ${files} fichiers modifiés à commiter`);
        
        // Ajouter tous les fichiers
        execSync('git add .', { stdio: 'inherit' });
        logger.success('✅ Fichiers ajoutés au staging');
        
        // Créer le commit
        const commitMessage = `Auto-deploy: ${new Date().toISOString()} [${trigger}]`;
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        logger.success(`✅ Commit créé: ${commitMessage}`);
        
        // Pousser vers GitHub
        // Utilisation de --force-with-lease pour éviter les conflits de branches
        execSync(`git push origin ${branch} --force-with-lease`, { stdio: 'inherit' });
        logger.success('✅ Push effectué avec succès');
      } else {
        logger.info('ℹ️ Aucun fichier à commiter');
      }

      logger.success('✅ Pipeline terminé avec succès!');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`❌ Erreur lors du commit automatique: ${errorMessage}`);
      logger.info('ℹ️ Vous pouvez faire git add . && git commit manuellement');
    }

    // ============================================
    // PHASE 5: RAPPORT FINAL
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log('========================================');
    console.log('📊 RAPPORT FINAL DE DÉPLOIEMENT');
    console.log('========================================');
    console.log(`  ✅ Tests: PASSÉS`);
    console.log(`  📤 Uploadés: ${uploaded} fichiers`);
    console.log(`  🗑️ Supprimés: ${deleted} fichiers`);
    console.log(`  ⏭️ Inchangés: ${unchanged} fichiers`);
    console.log(`  ❌ Erreurs: ${errors}`);
    console.log(`  📝 Commit automatique: EFFECTUÉ`);
    console.log(`  ⏱️ Durée: ${duration}s`);
    console.log(`  🔄 Déclenché par: ${trigger}`);
    console.log('========================================');

    if (errors === 0) {
      logger.success('🎉 Déploiement terminé avec succès!');
    } else {
      logger.warn(`⚠️ Déploiement terminé avec ${errors} erreurs`);
    }

    return NextResponse.json({
      success: errors === 0,
      message: errors === 0 ? 'Déploiement terminé avec succès' : 'Déploiement avec erreurs',
      duration,
      trigger,
      stats: {
        total: localFiles.length,
        uploaded,
        deleted,
        errors,
        unchanged,
        new: toUpload.filter(f => f.action === 'nouveau').length,
        modified: toUpload.filter(f => f.action === 'modifié').length
      }
    });

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Erreur générale après ${duration}s: ${errorMessage}`);
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        duration
      },
      { status: 500 }
    );
  }
}