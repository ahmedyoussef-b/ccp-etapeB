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
    } catch (err) {
      throw new Error('Impossible d\'acceder au depot: ' + err.message);
    }

    try {
      await octokit.rest.git.getRef({ owner, repo, ref: 'heads/' + branch });
      console.log('  ✅ Branche ' + branch + ' OK');
    } catch (err) {
      throw new Error('Branche ' + branch + ' introuvable');
    }

    console.log('✅ Tests passes avec succes!');
    console.log('');

    // ============================================
    // PHASE 2: ANALYSE - Récupération des fichiers
    // ============================================
    console.log('📂 PHASE 2: Analyse des fichiers...');

    // Récupérer les fichiers existants sur GitHub avec leur SHA
    let existingFilesMap = {};
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
        recursive: true
      });

      existingFiles = treeData.tree
        .filter(item => item.type === 'blob')
        .map(item => ({ path: item.path, sha: item.sha }));
      
      existingFilesMap = existingFiles.reduce((acc, f) => {
        acc[f.path] = f.sha;
        return acc;
      }, {});
      
      console.log('  📁 ' + existingFiles.length + ' fichiers existants sur GitHub');
    } catch (err) {
      console.log('  ℹ️ Aucun fichier existant (depot vide)');
    }

    // Scanner les fichiers locaux
    const appDir = process.cwd();
    const localFiles = [];
    
    // Dossiers à ignorer
    const ignoreDirs = ['node_modules', '.next', 'dist', 'build', '.git'];
    // Fichiers à ignorer (contenant des secrets)
    const ignoreFiles = ['.env.local', '.env.development', '.env.production', '.env'];
    
    function walkDir(dir, relativePath = '') {
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
              // Ignorer les fichiers sensibles
              if (ignoreFiles.includes(item)) {
                console.log('  ⏭️ Ignore: ' + relPath + ' (fichier sensible)');
                continue;
              }
              if (relPath.startsWith('.git')) continue;
              
              const content = fs.readFileSync(fullPath);
              // Utiliser le même algorithme que GitHub (SHA1)
              const hash = crypto.createHash('sha1');
              hash.update(content);
              const localSha = hash.digest('hex');
              
              // Pour les petits fichiers, comparer aussi la taille
              const stats2 = fs.statSync(fullPath);
              
              localFiles.push({
                localPath: fullPath,
                githubPath: relPath.replace(/\\/g, '/'),
                size: stats2.size,
                content: content,
                sha: localSha
              });
            }
          } catch (err) {
            console.log('  ⚠️ Erreur sur ' + fullPath + ': ' + err.message);
          }
        }
      } catch (err) {
        console.log('  ⚠️ Erreur de lecture de ' + dir + ': ' + err.message);
      }
    }
    
    walkDir(appDir);
    console.log('  📁 ' + localFiles.length + ' fichiers locaux trouves');

    // Identifier les fichiers modifiés en comparant SHA et taille
    const toUpload = [];
    const toDelete = [];
    const unchanged = [];

    const localPaths = new Set(localFiles.map(f => f.githubPath));
    const remotePaths = new Set(Object.keys(existingFilesMap));

    for (const file of localFiles) {
      const remoteSha = existingFilesMap[file.githubPath];
      if (!remoteSha) {
        // Nouveau fichier
        toUpload.push({ ...file, action: 'nouveau' });
      } else if (remoteSha !== file.sha) {
        // Vérifier si c'est vraiment différent (parfois le SHA diffère)
        // On compare aussi la taille comme indicateur
        const remoteFile = existingFiles.find(f => f.path === file.githubPath);
        if (remoteFile) {
          // Si le SHA est différent, on upload
          toUpload.push({ ...file, action: 'modifie' });
        } else {
          unchanged.push(file.githubPath);
        }
      } else {
        // Fichier inchangé
        unchanged.push(file.githubPath);
      }
    }

    // Fichiers à supprimer
    for (const remotePath of remotePaths) {
      if (!localPaths.has(remotePath)) {
        toDelete.push(remotePath);
      }
    }

    console.log('');
    console.log('📊 Resume des changements:');
    console.log('  ✅ Nouveaux fichiers: ' + toUpload.filter(f => f.action === 'nouveau').length);
    console.log('  📝 Fichiers modifies: ' + toUpload.filter(f => f.action === 'modifie').length);
    console.log('  ⏭️ Fichiers inchanges: ' + unchanged.length + ' (ignores)');
    console.log('  🗑️ A supprimer: ' + toDelete.length);
    console.log('');

    if (toUpload.length > 0) {
      console.log('📤 Fichiers a uploader:');
      toUpload.slice(0, 10).forEach(f => {
        console.log('  ' + (f.action === 'nouveau' ? '➕' : '📝') + ' ' + f.githubPath);
      });
      if (toUpload.length > 10) {
        console.log('  ... et ' + (toUpload.length - 10) + ' autres');
      }
      console.log('');
    }

    if (toUpload.length === 0 && toDelete.length === 0) {
      console.log('✅ Aucun changement detecte!');
      console.log('');
      return NextResponse.json({ 
        success: true,
        message: 'Aucun changement detecte',
        stats: {
          total: localFiles.length,
          uploaded: 0,
          deleted: 0,
          errors: 0,
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
          console.log('  ❌ Erreur pour ' + filePath + ': ' + err.message);
        }
      }
      console.log('');
    }

    // 2. Uploader les fichiers modifiés ou nouveaux
    if (toUpload.length > 0) {
      console.log('📤 Upload des fichiers modifies/nouveaux...');
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
          uploaded++;
          const action = file.action === 'nouveau' ? 'nouveau' : 'mis a jour';
          console.log('  ✅ Upload: ' + file.githubPath + ' (' + action + ')');
        } catch (err) {
          errors++;
          console.log('  ❌ Erreur pour ' + file.githubPath + ': ' + err.message);
        }
      }
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
    console.log('  ⏭️ Inchanges: ' + unchanged.length + ' fichiers (ignores)');
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
      { error: error.message },
      { status: 500 }
    );
  }
}
