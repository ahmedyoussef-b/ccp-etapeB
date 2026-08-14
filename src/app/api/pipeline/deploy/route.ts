import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'ahmedyoussef-b';
    const repo = process.env.GITHUB_REPO || 'ccp-etapeB';
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN not configured' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });
    console.log('🚀 Deploiement sur ' + owner + '/' + repo + ' (branche: ' + branch + ')');

    // ============================================
    // PHASE 1: TEST - Vérification
    // ============================================
    console.log('🔍 PHASE 1: Test de verification...');

    try {
      await octokit.rest.repos.get({ owner, repo });
      console.log('  ✅ Acces au depot OK');
    } catch (err: unknown) {
      throw new Error('Impossible d\'acceder au depot: ' + (err as Error).message);
    }

    try {
      await octokit.rest.git.getRef({ owner, repo, ref: 'heads/' + branch });
      console.log('  ✅ Branche ' + branch + ' OK');
    } catch {
      throw new Error('Branche ' + branch + ' introuvable');
    }

    console.log('✅ Tests passes avec succes!');
    console.log('');

    // ============================================
    // PHASE 2: ANALYSE - Récupération des fichiers
    // ============================================
    console.log('📂 PHASE 2: Analyse des fichiers...');

    // Récupérer les fichiers existants sur GitHub avec leur SHA
    let existingFilesMap: Record<string, string> = {};
    let existingFiles = [];
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: 'heads/' + branch
      });

      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: refData.object.sha,
        recursive: '1'
      });

      existingFiles = treeData.tree
        .filter(item => item.type === 'blob')
        .map(item => ({ path: item.path, sha: item.sha }));
      
      existingFilesMap = existingFiles.reduce<Record<string, string>>((acc, f) => {
        acc[f.path] = f.sha;
        return acc;
      }, {});
      
      console.log('  📁 ' + existingFiles.length + ' fichiers existants sur GitHub');
    } catch {
      console.log('  ℹ️ Aucun fichier existant (depot vide)');
    }

    // Scanner les fichiers locaux
    const appDir = process.cwd();
    const localFiles: Array<{
      localPath: string;
      githubPath: string;
      size: number;
      content: Buffer;
      sha: string;
    }> = [];
    
    const ignoreDirs = ['node_modules', '.next', 'dist', 'build', '.git'];
    const ignoreFiles = ['.env.local', '.env.development', '.env.production', '.env'];
    
    const walkDir = (dir: string, relativePath = ''): void => {
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
                console.log('  ⏭️ Ignore: ' + relPath + ' (fichier sensible)');
                continue;
              }
              if (relPath.startsWith('.git')) continue;
              
              const content = fs.readFileSync(fullPath);
              
              const blobHeader = 'blob ' + content.length + '\0';
              const blobData = Buffer.concat([Buffer.from(blobHeader), content]);
              const hash = crypto.createHash('sha1');
              hash.update(blobData);
              const localSha = hash.digest('hex');
              
              localFiles.push({
                localPath: fullPath,
                githubPath: relPath.replace(/\\/g, '/'),
                size: stats.size,
                content: content,
                sha: localSha
              });
            }
          } catch (err) {
            console.log('  ⚠️ Erreur sur ' + fullPath + ': ' + (err as Error).message);
          }
        }
      } catch (err) {
        console.log('  ⚠️ Erreur de lecture de ' + dir + ': ' + (err as Error).message);
      }
    };
    
    walkDir(appDir);
    console.log('  📁 ' + localFiles.length + ' fichiers locaux trouves');

    // Identifier les fichiers modifiés
    const toUpload = [];
    const toDelete = [];
    const unchanged = [];

    const localPaths = new Set(localFiles.map(f => f.githubPath));
    const remotePaths = new Set(Object.keys(existingFilesMap));

    for (const file of localFiles) {
      const remoteSha = existingFilesMap[file.githubPath];
      if (!remoteSha) {
        toUpload.push({ ...file, action: 'nouveau' });
      } else if (remoteSha !== file.sha) {
        toUpload.push({ ...file, action: 'modifie' });
      } else {
        unchanged.push(file.githubPath);
      }
    }

    for (const remotePath of Array.from(remotePaths)) {
      if (!localPaths.has(remotePath)) {
        toDelete.push(remotePath);
      }
    }

    console.log('');
    console.log('📊 Resume des changements:');
    console.log('  ✅ Nouveaux fichiers: ' + toUpload.filter(f => f.action === 'nouveau').length);
    console.log('  📝 Fichiers modifies: ' + toUpload.filter(f => f.action === 'modifie').length);
    console.log('  ⏭️ Fichiers inchanges: ' + unchanged.length);
    console.log('  🗑️ A supprimer: ' + toDelete.length);
    console.log('');

    // Afficher les fichiers modifiés
    if (toUpload.length > 0) {
      console.log('📤 Fichiers a uploader:');
      const displayFiles = toUpload.slice(0, 10);
      displayFiles.forEach(f => {
        console.log('  ' + (f.action === 'nouveau' ? '➕' : '📝') + ' ' + f.githubPath);
      });
      if (toUpload.length > 10) {
        console.log('  ... et ' + (toUpload.length - 10) + ' autres');
      }
      console.log('');
    }

    if (toUpload.length === 0 && toDelete.length === 0) {
      console.log('✅ Aucun changement detecte!');
      return NextResponse.json({ 
        success: true,
        message: 'Aucun changement detecte',
        stats: {
          total: localFiles.length,
          uploaded: 0,
          deleted: 0,
          unchanged: unchanged.length
        }
      });
    }

    // ============================================
    // PHASE 3: EXECUTION - Déploiement
    // ============================================
    console.log('🚀 PHASE 3: Execution du deploiement...');

    let uploaded = 0;
    let deleted = 0;
    let errors = 0;

    // 1. Supprimer les fichiers
    if (toDelete.length > 0) {
      console.log('🗑️ Suppression des fichiers...');
      for (const filePath of toDelete) {
        try {
          await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path: filePath,
            message: 'Suppression: ' + filePath,
            sha: existingFilesMap[filePath],
            branch
          });
          deleted++;
          console.log('  ✅ Supprime: ' + filePath);
        } catch (err) {
          errors++;
          console.log('  ❌ Erreur pour ' + filePath + ': ' + (err as Error).message);
        }
      }
      console.log('');
    }

    // 2. Uploader les fichiers modifiés ou nouveaux
    if (toUpload.length > 0) {
      console.log('📤 Upload des fichiers modifies/nouveaux...');
      let uploadedCount = 0;
      for (const file of toUpload) {
        try {
          const contentBase64 = file.content.toString('base64');
          const sha = existingFilesMap[file.githubPath] || undefined;
          
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.githubPath,
            message: 'Upload: ' + file.githubPath,
            content: contentBase64,
            branch,
            sha: sha
          });
          uploadedCount++;
          const action = file.action === 'nouveau' ? 'nouveau' : 'mis a jour';
          console.log('  ✅ Upload: ' + file.githubPath + ' (' + action + ')');
        } catch (err) {
          errors++;
          console.log('  ❌ Erreur pour ' + file.githubPath + ': ' + (err as Error).message);
        }
      }
      uploaded = uploadedCount;
    }

    // ============================================
    // PHASE 4: RAPPORT FINAL
    // ============================================
    console.log('');
    console.log('========================================');
    console.log('📊 RAPPORT FINAL DE DEPLOIEMENT');
    console.log('========================================');
    console.log('  ✅ Tests: PASSES');
    console.log('  📤 Uploades: ' + uploaded + ' fichiers');
    console.log('  🗑️ Supprimes: ' + deleted + ' fichiers');
    console.log('  ⏭️ Inchanges: ' + unchanged.length + ' fichiers');
    console.log('  ❌ Erreurs: ' + errors);
    console.log('========================================');

    if (errors === 0) {
      console.log('🎉 Deploiement termine avec succes!');
    } else {
      console.log('⚠️ Deploiement termine avec ' + errors + ' erreurs');
    }

    return NextResponse.json({ 
      success: errors === 0,
      message: errors === 0 ? 'Deploiement termine avec succes' : 'Deploiement avec erreurs',
      stats: {
        total: localFiles.length,
        uploaded: uploaded,
        deleted: deleted,
        errors: errors,
        unchanged: unchanged.length,
        new: toUpload.filter(f => f.action === 'nouveau').length,
        modified: toUpload.filter(f => f.action === 'modifie').length
      }
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
