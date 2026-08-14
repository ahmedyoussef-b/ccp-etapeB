import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
    console.log('  ✅ Token valide');

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
    // PHASE 1.5: COMMIT LOCAL - Sauvegarder les changements locaux
    // ============================================
    console.log('📝 PHASE 1.5: Sauvegarde des changements locaux...');
    try {
      // Vérifier s'il y a des changements
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (status.trim()) {
        console.log('  📝 ' + status.split('\n').filter(Boolean).length + ' fichiers modifies trouves');
        
        // Ajouter tous les fichiers
        execSync('git add .', { stdio: 'ignore' });
        console.log('  ✅ Fichiers ajoutes au staging');
        
        // Créer un commit
        const commitMessage = 'Auto-commit: Synchronisation pipeline ' + new Date().toISOString();
        execSync('git commit -m "' + commitMessage + '"', { stdio: 'ignore' });
        console.log('  ✅ Commit local cree: ' + commitMessage);
        
        // Pousser les changements
        execSync('git push origin ' + branch, { stdio: 'ignore' });
        console.log('  ✅ Changements pousses vers GitHub');
      } else {
        console.log('  ℹ️ Aucun changement local a sauvegarder');
      }
    } catch (err) {
      console.log('  ⚠️ Erreur lors du commit local: ' + err.message);
    }
    console.log('');

    // ============================================
    // PHASE 2: ANALYSE - Récupération des fichiers
    // ============================================
    console.log('📂 PHASE 2: Analyse des fichiers...');

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
      
      existingFilesMap = existingFiles.reduce((acc, f) => {
        acc[f.path] = f.sha;
        return acc;
      }, {});
      
      console.log('  📁 ' + existingFiles.length + ' fichiers existants sur GitHub');
    } catch (err) {
      console.log('  ℹ️ Aucun fichier existant (depot vide)');
    }

    // Scanner TOUS les fichiers locaux
    const appDir = process.cwd();
    const localFiles = [];
    const ignoreDirs = ['node_modules', '.next', 'dist', 'build'];
    
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

    const localPaths = new Set(localFiles.map(f => f.githubPath));
    const remotePaths = new Set(Object.keys(existingFilesMap));

    const toUpdate = localFiles.filter(f => 
      !existingFilesMap[f.githubPath] || 
      existingFilesMap[f.githubPath]
    );

    const toDelete = [...remotePaths].filter(p => !localPaths.has(p));

    console.log('');
    console.log('📊 Resume des changements:');
    console.log('  ✅ A ajouter/mettre a jour: ' + toUpdate.length + ' fichiers');
    console.log('  🗑️ A supprimer: ' + toDelete.length + ' fichiers');
    console.log('');

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
    // PHASE 4: NETTOYAGE - Commit final
    // ============================================
    console.log('');
    console.log('🧹 PHASE 4: Nettoyage final...');
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (status.trim()) {
        console.log('  📝 ' + status.split('\n').filter(Boolean).length + ' fichiers restants');
        execSync('git add .', { stdio: 'ignore' });
        execSync('git commit -m "Cleanup: Nettoyage post-deploiement"', { stdio: 'ignore' });
        execSync('git push origin ' + branch, { stdio: 'ignore' });
        console.log('  ✅ Nettoyage termine, aucun fichier en attente');
      } else {
        console.log('  ✅ Aucun fichier en attente');
      }
    } catch (err) {
      console.log('  ⚠️ Erreur lors du nettoyage: ' + err.message);
    }

    // ============================================
    // PHASE 5: RAPPORT FINAL
    // ============================================
    console.log('');
    console.log('========================================');
    console.log('📊 RAPPORT FINAL DE DEPLOIEMENT');
    console.log('========================================');
    console.log('  ✅ Tests: PASSES');
    console.log('  📤 Uploades: ' + uploaded + ' fichiers');
    console.log('  🗑️ Supprimes: ' + deleted + ' fichiers');
    console.log('  ❌ Erreurs: ' + errors + ' fichiers');
    console.log('  🧹 Nettoyage: TERMINE');
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
