let featureExtractor: ((input: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }>) | null = null;
let initPromise: Promise<void> | null = null;

async function loadPipeline() {
  if (featureExtractor) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const transformers = await import("@xenova/transformers");
    const { pipeline, env } = transformers;

    env.allowLocalModels = false;
    env.useBrowserCache = true;

    featureExtractor = (await pipeline("feature-extraction", "Xenova/clip-vit-base-patch32", {
      progress_callback: (p: { status?: string; loaded?: number; total?: number; file?: string }) => {
        if (p.status === "progress" && p.total) {
          const pct = Math.round(((p.loaded ?? 0) / p.total) * 100);
          console.log(`[Vision] Chargement modèle: ${pct}%`);
        } else if (p.status === "done") {
          console.log(`[Vision] Modèle chargé: ${p.file ?? "fichier"}`);
        }
      },
    })) as (input: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }>;
  })();

  return initPromise;
}

export async function initVision(): Promise<void> {
  return loadPipeline();
}

export async function getImageEmbedding(imageDataUrl: string): Promise<number[]> {
  await loadPipeline();
  if (!featureExtractor) {
    throw new Error("Modèle de vision non initialisé");
  }

  const result = await featureExtractor(imageDataUrl, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(result.data);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function isVisionReady(): boolean {
  return featureExtractor !== null;
}
