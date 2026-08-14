'use client';

import { useState } from 'react';

export function DeployPipeline() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle');

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setProgress(0);
    setLogs([]);
    setStatus('loading');

    try {
      addLog('Démarrage du déploiement complet...');
      setProgress(10);

      addLog('Analyse du dépôt distant...');
      setProgress(20);

      addLog('Scan des fichiers du projet...');
      setProgress(40);

      const response = await fetch('/api/pipeline/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      addLog('Création et arborescence GitHub...');
      setProgress(60);

      addLog('Branch : main');
      setProgress(80);

      if (response.ok) {
        addLog(`Fichiers : ${data.stats.uploaded}`);
        addLog('Déploiement terminé avec succès !');
        setProgress(100);
        setStatus('success');
      } else {
        addLog('Erreur: ' + data.error);
        setStatus('error');
      }

    } catch (error) {
      addLog('Erreur: ' + error.message);
      setStatus('error');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Déploiement complet de l'application
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          vers https://github.com/ahmedyoussef-b/ccp-etapeB.git
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Avancement du pipeline
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${
              status === 'success' ? 'bg-green-500' : 
              status === 'error' ? 'bg-red-500' : 
              'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-xs">
        {['Initialisation', 'Analyse du dépôt', 'Scan des fichiers', 'Upload des fichiers', 'Création du commit'].map((step, index) => (
          <div key={index} className="text-center">
            <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold ${
              progress >= (index + 1) * 20 ? 'bg-green-500' : 
              progress > index * 20 ? 'bg-blue-400' : 
              'bg-gray-300 dark:bg-gray-600'
            }`}>
              {index + 1}
            </div>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{step}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Journal d'exécution
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {logs.length} lignes
          </span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-4">
              En attente de déploiement...
            </p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="py-0.5">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={handleDeploy}
        disabled={isDeploying}
        className={`w-full py-3 px-4 text-white font-medium rounded-lg transition-colors ${
          isDeploying ? 'bg-gray-400 cursor-not-allowed' :
          status === 'success' ? 'bg-green-500 hover:bg-green-600' :
          status === 'error' ? 'bg-red-500 hover:bg-red-600' :
          'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isDeploying ? 'Déploiement en cours...' : 'Lancer le déploiement'}
      </button>
    </div>
  );
}
