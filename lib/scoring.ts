export type SimilarityBreakdown = {
	cosineSimilarity?: number;
	jaccardSimilarity?: number;
	heuristicBonus?: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
	const min = Math.min(a.length, b.length);
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < min; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function jaccardSimilarity(a: string, b: string): number {
	const tokenize = (s: string) =>
		new Set(
			s
				.toLowerCase()
				.replace(/[^\w\s]/g, ' ')
				.split(/\s+/)
				.filter(Boolean),
		);
	const setA = tokenize(a);
	const setB = tokenize(b);
	const intersection = new Set([...setA].filter((x) => setB.has(x)));
	const union = new Set([...setA, ...setB]);
	if (union.size === 0) return 0;
	return intersection.size / union.size;
}

const COMPOSITION_TERMS = ['centered', 'framing', 'rule of thirds', 'symmetry', 'off-center', 'portrait', 'landscape', 'wide shot', 'close-up'];
const LIGHTING_TERMS = ['lighting', 'backlit', 'soft light', 'hard light', 'shadow', 'high key', 'low key', 'golden hour', 'ambient'];
const PERSPECTIVE_TERMS = ['perspective', 'aerial', 'bird’s-eye', 'worm’s-eye', 'tilt', 'angle', 'top-down', 'isometric', 'closeup', 'macro'];

export function heuristicPromptBonus(prompt: string): number {
	const p = prompt.toLowerCase();
	let bonus = 0;
	const hasComposition = COMPOSITION_TERMS.some((t) => p.includes(t));
	const hasLighting = LIGHTING_TERMS.some((t) => p.includes(t));
	const hasPerspective = PERSPECTIVE_TERMS.some((t) => p.includes(t));
	if (hasComposition) bonus += 4;
	if (hasLighting) bonus += 4;
	if (hasPerspective) bonus += 4;
	// Bonus for explicit size/background mentions
	if (/\b(small|medium|large|tiny|huge)\b/.test(p)) bonus += 3;
	if (/\bbackground\b/.test(p)) bonus += 3;
	// Cap bonus
	return Math.min(bonus, 12);
}

export function computeFinalScore(similarity01: number, heuristicBonus: number): number {
	// Convert similarity [0,1] -> 0..100 then add bonus (capped)
	const base = Math.max(0, Math.min(100, similarity01 * 100));
	return Math.max(0, Math.min(100, base + heuristicBonus));
}

/**
 * Simple scoring for medium/hard/advanced/expert/daily tiers
 * Let Vertex AI embeddings be the judge - they already understand
 * lighting, composition, mood, style, texture, and scene coherence
 */
export function computeDailyExpertScore(
	similarity01: number,
	prompt: string,
): number {
	// That's it. No boosts. No penalties. No word counts.
	// Let the AI be the AI.
	return Math.round(similarity01 * 100);
}


