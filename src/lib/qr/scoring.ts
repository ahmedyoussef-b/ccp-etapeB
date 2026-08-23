export interface QAResult {
  question: string;
  answer: string;
  score: number;
}

export function computeWordScore(question: string, candidate: string): number {
  const q = question.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();

  if (!q || !c) return 0;
  if (q === c) return 1.0;
  if (q.includes(c) || c.includes(q)) return 0.8;

  const wordsQ = new Set(q.split(/\s+/).filter(Boolean));
  const wordsC = new Set(c.split(/\s+/).filter(Boolean));

  let intersection = 0;
  for (const w of Array.from(wordsQ)) {
    if (wordsC.has(w)) intersection++;
  }
  const union = new Set([...Array.from(wordsQ), ...Array.from(wordsC)]).size;

  return union > 0 ? intersection / union : 0;
}

export function rankResults(query: string, pairs: QAResult[]): QAResult[] {
  return pairs
    .map((p) => ({
      ...p,
      score: computeWordScore(query, p.question),
    }))
    .sort((a, b) => b.score - a.score);
}
