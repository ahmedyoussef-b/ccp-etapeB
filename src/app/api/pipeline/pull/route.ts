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
    console.log('📥 Pull depuis ' + owner + '/' + repo + ' (branche: ' + branch + ')');

    // ============================================
    // PHASE 1: TEST - Vérification
    // ============================================
    console.log('🔍 PHASE 1: Test de verification...');

    // Vérifier l'accès au dépôt
    try {
      await octokit.rest.repos.get({ owner, repo });
      console.log('  ✅ Acces au depot OK');
    } catch (err) {
      throw new Error('Impossible d\'acceder au depot: ' + (err as Error).message);
    }

    // Vérifier la branche
    try {
      await octokit.rest.git.getRef({ owner, repo, ref: 'heads/' + branch });
      console.log('  ✅ Branche ' + branch + ' OK');
    } catch {
      throw new Error('Branche ' + branch + ' introuvable');
    }

    console.log('✅ Tests passes avec succes!');
    console.log('');

    // ============================================
    // PHASE 2: ANALYSE - Récupération des fichiers GitHub
    // ============================================
    console.log('📂 PHASE 2: Recuperation des fichiers depuis GitHub...');

    // Récupérer tous les fichiers du dépôt
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

    const githubFiles = treeData.tree
      .filter(item => item.type === 'blob')
      .map(item => ({ path: item.path, sha: item.sha }));

    console.log('  📁 ' + githubFiles.length + ' fichiers trouves sur GitHub');

    // ============================================
    // PHASE 3: TÉLÉCHARGEMENT - Pull des fichiers
    // ============================================
    console.log('📥 PHASE 3: Telechargement des fichiers...');

    let downloaded = 0;
    let errors = 0;
    const appDir = process.cwd();

    for (const file of githubFiles) {
      try {
        // Récupérer le contenu du fichier
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branch
        });

        // Décoder le contenu Base64
        const content = Buffer.from((fileData as { content: string }).content, 'base64');

        // Créer le chemin local
        const localPath = path.join(appDir, file.path);

        // Créer les dossiers si nécessaire
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Écrire le fichier
        fs.writeFileSync(localPath, content);
        downloaded++;
        console.log('  ✅ Telecharge: ' + file.path);

      } catch (err) {
        errors++;
        console.log('  ❌ Erreur pour ' + file.path + ': ' + (err as Error).message);
      }
    }

    // ============================================
    // PHASE 4: RAPPORT FINAL
    // ============================================
    console.log('');
    console.log('========================================');
    console.log('📊 RAPPORT FINAL DU PULL');
    console.log('========================================');
    console.log('  ✅ Tests: PASSES');
    console.log('  📥 Telecharges: ' + downloaded + ' fichiers');
    console.log('  ❌ Erreurs: ' + errors + ' fichiers');
    console.log('========================================');

    if (errors === 0) {
      console.log('🎉 Pull termine avec succes!');
    } else {
      console.log('⚠️ Pull termine avec ' + errors + ' erreurs');
    }

    return NextResponse.json({ 
      success: errors === 0,
      message: errors === 0 ? 'Pull termine avec succes' : 'Pull avec erreurs',
      stats: {
        total: githubFiles.length,
        downloaded: downloaded,
        errors: errors
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
