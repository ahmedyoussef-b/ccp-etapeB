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
    console.log('Deploiement sur ' + owner + '/' + repo + ' (branche: ' + branch + ')');

    // 1. Récupérer tous les fichiers existants sur GitHub
    console.log('Recuperation des fichiers existants...');
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
        .map(item => item.path);
      
      console.log(existingFiles.length + ' fichiers existants sur GitHub');
    } catch (err) {
      console.log('Aucun fichier existant (depot vide)');
    }

    // 2. Scanner les fichiers locaux
    console.log('Scan des fichiers locaux...');
    const appDir = process.cwd();
    const filesToUpload = [];
    const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.local-db', '.registry', '.vscode', '.idea'];
    
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
              filesToUpload.push({
                localPath: fullPath,
                githubPath: relPath.replace(/\\/g, '/')
              });
            }
          } catch (err) {
            console.log('Erreur sur ' + fullPath + ': ' + err.message);
          }
        }
      } catch (err) {
        console.log('Erreur de lecture de ' + dir + ': ' + err.message);
      }
    }
    
    walkDir(appDir);
    console.log(filesToUpload.length + ' fichiers trouves');

    // 3. Uploader les fichiers (supprimer d'abord s'ils existent)
    let uploaded = 0;
    let errors = 0;
    
    for (const file of filesToUpload) {
      try {
        const content = fs.readFileSync(file.localPath);
        const contentBase64 = content.toString('base64');
        
        // Vérifier si le fichier existe déjà
        let sha = null;
        if (existingFiles.includes(file.githubPath)) {
          try {
            const { data: existingFile } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.githubPath,
              ref: branch
            });
            sha = existingFile.sha;
            console.log('Fichier existant: ' + file.githubPath + ' (SHA: ' + sha.substring(0, 7) + ')');
          } catch (err) {
            console.log('Erreur lors de la recuperation de ' + file.githubPath + ': ' + err.message);
          }
        }
        
        // Créer ou mettre à jour le fichier
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.githubPath,
          message: 'Upload: ' + file.githubPath,
          content: contentBase64,
          branch,
          sha: sha || undefined
        });
        
        uploaded++;
        console.log('Uploadé: ' + file.githubPath);
        
      } catch (err) {
        errors++;
        console.log('Erreur pour ' + file.githubPath + ': ' + err.message);
      }
    }

    console.log('Deploiement termine!');
    console.log(uploaded + ' fichiers uploades, ' + errors + ' erreurs');

    return NextResponse.json({ 
      success: true, 
      stats: { 
        total: filesToUpload.length, 
        uploaded: uploaded, 
        errors: errors 
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
