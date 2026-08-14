import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    // Récupérer les variables d'environnement
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'ahmedyoussef-b';
    const repo = process.env.GITHUB_REPO || 'ccp-etapeB';
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN not configured. Please set it in .env.local' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });

    console.log('🚀 Deploiement sur ' + owner + '/' + repo + ' (branche: ' + branch + ')');

    // 1. Scanner les fichiers locaux
    console.log('📂 Scan des fichiers locaux...');
    const appDir = process.cwd();
    const filesToUpload = [];
    
    // Dossiers à ignorer
    const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.local-db', '.registry'];
    
    function walkDir(dir, relativePath = '') {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          // Ignorer certains dossiers
          if (ignoreDirs.includes(item)) continue;
          if (item.startsWith('.')) continue;
          
          const fullPath = path.join(dir, item);
          const relPath = relativePath ? path.join(relativePath, item) : item;
          
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
              walkDir(fullPath, relPath);
            } else {
              filesToUpload.push({
                localPath: fullPath,
                githubPath: relPath.replace(/\\/g, '/')
              });
            }
          } catch (err) {
            console.log('⚠️ Erreur sur ' + fullPath + ': ' + err.message);
          }
        }
      } catch (err) {
        console.log('⚠️ Erreur de lecture de ' + dir + ': ' + err.message);
      }
    }
    
    walkDir(appDir);
    console.log('📁 ' + filesToUpload.length + ' fichiers trouves');

    // 2. Uploader tous les fichiers
    console.log('📤 Upload des fichiers...');
    let uploaded = 0;
    let errors = 0;
    
    for (const file of filesToUpload) {
      try {
        const content = fs.readFileSync(file.localPath);
        const contentBase64 = content.toString('base64');
        
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.githubPath,
          message: 'Upload: ' + file.githubPath,
          content: contentBase64,
          branch
        });
        uploaded++;
        console.log('✅ Uploadé: ' + file.githubPath);
      } catch (err) {
        errors++;
        console.log('❌ Erreur pour ' + file.githubPath + ': ' + err.message);
      }
    }

    console.log('✅ Deploiement termine!');
    console.log('📊 ' + uploaded + ' fichiers uploades, ' + errors + ' erreurs');

    return NextResponse.json({ 
      success: true, 
      message: 'Deploiement termine avec succes',
      stats: {
        total: filesToUpload.length,
        uploaded: uploaded,
        errors: errors
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
