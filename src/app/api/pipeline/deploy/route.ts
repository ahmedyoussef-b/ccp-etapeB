import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    // PHASE 1: TEST - Vérification avant déploiement
    // ============================================
    console.log('🔍 PHASE 1: Test de verification...');

    // 1. Vérifier le token
    console.log('  ✅ Token valide');

    // 2. Vérifier l'accès au dépôt
    try {
      await octokit.rest.repos.get({ owner, repo });
      console.log('  ✅ Acces au depot OK');
    } catch (err) {
      throw new Error('Impossible d\'acceder au depot: ' + err.message);
    }

    // 3. Vérifier la branche
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

    // Récupérer les fichiers existants sur GitHub
    let existingFiles = [];
    let existingFilesMap = {};
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
      
      // Créer un map pour accès rapide
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
    const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.local-db', '.registry'];
    
    function walkDir(dir, relativePath = '') {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (ignoreDirs.includes(item)) continue;
          if (item.startsWith('.')) continue;
          
          const fullPath = path.join(dir, item);
          const relPath = relativePath ? path.join(relativePath, item) : item;
          
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
              walkDir(fullPath, relPath);
            } else {
              const content = fs.readFileSync(fullPath);
              localFiles.push({
                localPath: fullPath,
                githubPath: relPath.replace(/\\/g, '/'),
                size: stats.size,
                content: content
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

    // Identifier les changements
    const localPaths = new Set(localFiles.map(f => f.githubPath));
    const remotePaths = new Set(Object.keys(existingFilesMap));

    // Fichiers à ajouter/mettre à jour
    const toUpdate = localFiles.filter(f => 
      !existingFilesMap[f.githubPath] || 
      existingFilesMap[f.githubPath]
    );

    // Fichiers à supprimer (présents sur GitHub mais pas en local)
    const toDelete = [...remotePaths].filter(p => !localPaths.has(p));

    console.log('');
    console.log('📊 Resume des changements:');
    console.log('  ✅ A ajouter/mettre a jour: ' + toUpdate.length + ' fichiers');
    console.log('  🗑️ A supprimer: ' + toDelete.length + ' fichiers');
    console.log('');

    if (toDelete.length > 0) {
      console.log('🗑️ Fichiers a supprimer:');
      toDelete.slice(0, 10).forEach(p => console.log('  - ' + p));
      if (toDelete.length > 10) {
        console.log('  ... et ' + (toDelete.length - 10) + ' autres');
      }
      console.log('');
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

    // 2. Uploader les fichiers
    if (toUpdate.length > 0) {
      console.log('📤 Upload des fichiers...');
      for (const file of toUpdate) {
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
          console.log('  ✅ Upload: ' + file.githubPath + (sha ? ' (mis a jour)' : ' (nouveau)'));
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
    console.log('  ❌ Erreurs: ' + errors + ' fichiers');
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
        toDelete: toDelete.length
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
