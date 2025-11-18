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
 * Strict scoring for daily/expert tiers with wider range and harsh penalties
 * Base similarity pushed to 0-120 range, then penalties and bonuses applied
 */
export function computeDailyExpertScore(
	similarity01: number,
	prompt: string,
	targetDescription: string,
): number {
	// 1. Base similarity is too forgiving — tighten the curve
	let base = similarity01 * 120; // push to 0–120 range

	// 2. Harsh penalty for missing key elements
	const targetLower = targetDescription.toLowerCase();
	const promptLower = prompt.toLowerCase();
	
	const missing = [
		// Check for rain/wet in target, penalize if missing in prompt
		(targetLower.match(/rain|wet/i) && !promptLower.match(/rain|wet/i)) ? -20 : 0,
		// Check for umbrella in target, penalize if missing in prompt
		(targetLower.match(/umbrella/i) && !promptLower.match(/umbrella/i)) ? -15 : 0,
		// Check for night/dark in target, penalize if missing in prompt
		(targetLower.match(/night|dark/i) && !promptLower.match(/night|dark/i)) ? -10 : 0,
		// Discourage lazy prompts (too short)
		prompt.split(' ').length < 8 ? -5 : 0,
	].reduce((a, b) => a + b, 0);

	// 3. Bonus only for excellence
	const bonus = (prompt.includes('--no') || prompt.includes('--ar')) ? 8 : 0;

	return Math.max(0, Math.min(100, Math.round(base + missing + bonus)));
}


