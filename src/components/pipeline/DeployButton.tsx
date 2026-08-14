'use client';

import { useState } from 'react';

export function DeployButton() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');

  const handleDeploy = async () => {
    setIsDeploying(true);
    setStatus('loading');
    setMessage('Deploiement en cours...');

    try {
      const response = await fetch('/api/pipeline/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Deploiement reussi! ' + data.stats.uploaded + ' fichiers uploades.');
      } else {
        setStatus('error');
        setMessage('Erreur: ' + data.error);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erreur de connexion: ' + error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case 'success': return 'bg-green-500 hover:bg-green-600';
      case 'error': return 'bg-red-500 hover:bg-red-600';
      case 'loading': return 'bg-blue-500 hover:bg-blue-600';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold">Deploiement GitHub</h2>
      <p className="text-sm text-gray-600 text-center">
        Deploie tout le projet sur GitHub en preservant la structure des dossiers.
      </p>
      <button
        onClick={handleDeploy}
        disabled={isDeploying}
        className={'px-6 py-3 text-white font-semibold rounded-lg transition-colors ' + getButtonColor() + ' disabled:opacity-50'}
      >
        {isDeploying ? 'Deploiement...' : 'Deployer tout le projet'}
      </button>
      {message && (
        <div className={'p-3 rounded-lg w-full text-center ' + (status === 'success' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>
          {message}
        </div>
      )}
    </div>
  );
}
