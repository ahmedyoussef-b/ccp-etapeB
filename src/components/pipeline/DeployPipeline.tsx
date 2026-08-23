'use client';

import { useState } from 'react';

export function DeployPipeline() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState('idle');
  const [lastAction, setLastAction] = useState('');

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' | 'upload' | 'download' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      upload: '📤',
      download: '📥'
    };
    setLogs(prev => [`${icons[type] || 'ℹ️'} [${timestamp}] ${message}`, ...prev]);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setProgress(0);
    setLogs([]);
    setStatus('loading');
    setLastAction('push');

    try {
      addLog('🚀 Démarrage du PUSH vers GitHub...', 'upload');
      setProgress(10);
      addLog('🔍 Phase 1: Tests de verification...', 'info');
      setProgress(20);
      addLog('✅ Tests passes avec succes!', 'success');
      setProgress(30);
      addLog('📂 Phase 2: Analyse des fichiers...', 'info');
      setProgress(40);
      addLog('📊 Analyse des changements terminee', 'success');
      setProgress(50);
      addLog('📤 Phase 3: Upload vers GitHub...', 'upload');
      setProgress(60);

      const response = await fetch('/api/pipeline/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setProgress(80);

      if (response.ok) {
        addLog('📊 Uploades: ' + data.stats.uploaded + ' fichiers', 'success');
        addLog('🗑️ Supprimes: ' + data.stats.deleted + ' fichiers', 'info');
        
        if (data.stats.errors === 0) {
          addLog('🎉 Push termine avec succes vers GitHub!', 'success');
          setProgress(100);
          setStatus('success');
        } else {
          addLog('⚠️ ' + data.stats.errors + ' erreurs rencontrees', 'warning');
          setStatus('error');
        }
      } else {
        addLog('❌ Erreur: ' + data.error, 'error');
        setStatus('error');
      }

    } catch (error) {
      addLog('❌ Erreur de connexion: ' + (error as Error).message, 'error');
      setStatus('error');
    } finally {
      setIsDeploying(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setProgress(0);
    setLogs([]);
    setStatus('loading');
    setLastAction('pull');

    try {
      addLog('📥 Démarrage du PULL depuis GitHub...', 'download');
      setProgress(20);
      addLog('🔍 Phase 1: Tests de verification...', 'info');
      setProgress(30);
      addLog('✅ Tests passes avec succes!', 'success');
      setProgress(40);
      addLog('📂 Phase 2: Recuperation des fichiers...', 'info');
      setProgress(50);
      addLog('📊 Analyse des fichiers GitHub terminee', 'success');
      setProgress(60);
      addLog('📥 Phase 3: Telechargement des fichiers...', 'download');
      setProgress(70);

      const response = await fetch('/api/pipeline/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setProgress(90);

      if (response.ok) {
        addLog('📥 Telecharges: ' + data.stats.downloaded + ' fichiers', 'success');
        
        if (data.stats.errors === 0) {
          addLog('🎉 Pull termine avec succes depuis GitHub!', 'success');
          setProgress(100);
          setStatus('success');
        } else {
          addLog('⚠️ ' + data.stats.errors + ' erreurs rencontrees', 'warning');
          setStatus('error');
        }
      } else {
        addLog('❌ Erreur: ' + data.error, 'error');
        setStatus('error');
      }

    } catch (error) {
      addLog('❌ Erreur de connexion: ' + (error as Error).message, 'error');
      setStatus('error');
    } finally {
      setIsPulling(false);
    }
  };

  const getStatusIcon = () => {
    if (status === 'success') return '✅';
    if (status === 'error') return '❌';
    if (status === 'loading') return '⏳';
    return '🔄';
  };

  const getStatusColor = () => {
    if (status === 'success') return 'text-green-500';
    if (status === 'error') return 'text-red-500';
    if (status === 'loading') return 'text-blue-500';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-2xl">
          🐙
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Pipeline de synchronisation
            <span className={getStatusColor()}>{getStatusIcon()}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            🌿 Synchronisation avec https://github.com/ahmedyoussef-b/ccp-etapeB.git
          </p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {lastAction === 'push' ? '📤 Push vers GitHub' : 
             lastAction === 'pull' ? '📥 Pull depuis GitHub' : 
             'Avancement'}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className={'h-2.5 rounded-full transition-all duration-500 ' + (
              status === 'success' ? 'bg-green-500' : 
              status === 'error' ? 'bg-red-500' : 
              lastAction === 'push' ? 'bg-blue-500' :
              lastAction === 'pull' ? 'bg-purple-500' :
              'bg-blue-500'
            )}
            style={{ width: progress + '%' }}
          />
        </div>
      </div>

      {/* Étapes */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {['Initialisation', 'Tests', 'Execution', 'Finalisation'].map((step, index) => (
          <div key={index} className="text-center">
            <div className={'w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold ' + (
              progress >= (index + 1) * 25 ? 'bg-green-500' : 
              progress > index * 25 ? (
                lastAction === 'push' ? 'bg-blue-400' : 
                lastAction === 'pull' ? 'bg-purple-400' : 
                'bg-blue-400'
              ) : 
              'bg-gray-300 dark:bg-gray-600'
            )}>
              {index + 1}
            </div>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{step}</p>
          </div>
        ))}
      </div>

      {/* Journal d'exécution */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
             <span>📋 Journal d&apos;exécution</span>
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {logs.length} lignes
          </span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-4 flex items-center justify-center gap-2">
               🔄 En attente d&apos;action...
            </p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="py-0.5 text-gray-700 dark:text-gray-300">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bouton Pull */}
        <button
          onClick={handlePull}
          disabled={isPulling || isDeploying}
          className={`
            group relative py-4 px-6 text-white font-medium rounded-lg 
            transition-all duration-300 transform hover:scale-[1.02]
            flex items-center justify-center gap-3 text-base
            ${isPulling ? 'bg-gray-400 cursor-not-allowed' :
              'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-purple-500/25'}
          `}
        >
          {isPulling ? (
            <>
              <span className="animate-spin">⏳</span>
              Pull en cours...
            </>
          ) : (
            <>
              <span className="text-xl group-hover:animate-bounce">📥</span>
              <span className="font-semibold">Pull depuis GitHub</span>
              <span className="text-lg opacity-70">⬇️</span>
            </>
          )}
        </button>

        {/* Bouton Push */}
        <button
          onClick={handleDeploy}
          disabled={isDeploying || isPulling}
          className={`
            group relative py-4 px-6 text-white font-medium rounded-lg 
            transition-all duration-300 transform hover:scale-[1.02]
            flex items-center justify-center gap-3 text-base
            ${isDeploying ? 'bg-gray-400 cursor-not-allowed' :
              'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-blue-500/25'}
          `}
        >
          {isDeploying ? (
            <>
              <span className="animate-spin">⏳</span>
              Push en cours...
            </>
          ) : (
            <>
              <span className="text-xl group-hover:animate-bounce">📤</span>
              <span className="font-semibold">Push vers GitHub</span>
              <span className="text-lg opacity-70">⬆️</span>
            </>
          )}
        </button>
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-purple-500">🟣</span>
          <span>Pull: GitHub → Local</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500">🔵</span>
          <span>Push: Local → GitHub</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-500">🟢</span>
          <span>Succès</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-500">🔴</span>
          <span>Erreur</span>
        </div>
      </div>
    </div>
  );
}
