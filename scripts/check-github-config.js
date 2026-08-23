// scripts/check-github-config.js
const { Octokit } = require('@octokit/rest');
require('dotenv').config({ path: '.env.local' });

async function checkConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  console.log('Verification de la configuration GitHub...');
  console.log('===========================================');
  console.log('Repository: ' + owner + '/' + repo);
  console.log('Branche: ' + branch);
  console.log('Token: ' + (token ? 'PRESENT' : 'MANQUANT'));
  console.log('===========================================');

  if (!token) {
    console.error('ERREUR: Token manquant!');
    return;
  }

  if (!owner || !repo) {
    console.error('ERREUR: Owner ou Repository manquant!');
    return;
  }

  try {
    const octokit = new Octokit({ auth: token });
    
    console.log('Test de connexion a GitHub...');
    const { data } = await octokit.rest.repos.get({
      owner,
      repo
    });
    
    console.log('SUCCES: Connexion reussie!');
    console.log('Repo: ' + data.name + ' (' + (data.private ? 'Prive' : 'Public') + ')');
    console.log('Stars: ' + data.stargazers_count);
    
    console.log('Verification de la branche ' + branch + '...');
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/' + branch
    });
    
    console.log('SUCCES: Branche ' + branch + ' trouvee (SHA: ' + refData.object.sha.substring(0, 7) + ')');
    
    console.log('Test des permissions d\'ecriture...');
    const testContent = Buffer.from('Test de configuration - ' + new Date().toISOString()).toString('base64');
    
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.test-config.md',
        message: 'Test de configuration GitHub',
        content: testContent,
        branch
      });
      console.log('SUCCES: Permissions d\'ecriture OK!');
      
      const { data: testFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '.test-config.md',
        ref: branch
      });
      
      await octokit.rest.repos.deleteFile({
        owner,
        repo,
        path: '.test-config.md',
        message: 'Suppression du fichier de test',
        sha: testFile.sha,
        branch
      });
      console.log('SUCCES: Fichier de test supprime');
      
    } catch (writeError) {
      console.log('ERREUR d\'ecriture:', writeError.message);
    }
    
    console.log('===========================================');
    console.log('SUCCES: Configuration valide!');
    console.log('Le pipeline GitHub est pret a etre utilise.');
    
  } catch (error) {
    console.error('ERREUR de connexion:', error.message);
    if (error.status === 401) {
      console.log('Token invalide ou expire. Regenezerez un nouveau token.');
    }
    if (error.status === 404) {
      console.log('Repository ' + owner + '/' + repo + ' non trouve.');
      console.log('Assurez-vous que le depot existe sur GitHub.');
    }
    console.log('===========================================');
  }
}

checkConfig();
