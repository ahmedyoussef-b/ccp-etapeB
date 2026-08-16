// src/app/api/pipeline/webhook/route.ts
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

const logger = {
  info: (msg: string) => console.log(`[Webhook] ℹ️ ${msg}`),
  success: (msg: string) => console.log(`[Webhook] ✅ ${msg}`),
  error: (msg: string) => console.log(`[Webhook] ❌ ${msg}`)
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, repository } = body;

    logger.info(`Webhook reçu: ${event} pour ${repository?.full_name || 'inconnu'}`);

    // Vérification du secret (optionnel)
    const secret = process.env.WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-webhook-secret');
    
    if (secret && providedSecret !== secret) {
      logger.error('Secret invalide');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ne déclencher que sur push vers main
    if (event === 'push' && repository?.default_branch === 'main') {
      logger.success('Déclenchement du déploiement automatique...');
      
      // Déclencher le déploiement
      try {
        execSync('curl -X POST http://localhost:3000/api/pipeline/deploy -H "Content-Type: application/json" -d \'{"trigger":"webhook"}\'', {
          stdio: 'ignore'
        });
        logger.success('Déploiement déclenché avec succès');
      } catch (error) {
        logger.error(`Erreur lors du déclenchement: ${(error as Error).message}`);
      }
    } else {
      logger.info(`Événement ignoré: ${event}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook reçu avec succès' 
    });

  } catch (error) {
    logger.error(`Erreur: ${(error as Error).message}`);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}