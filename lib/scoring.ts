import { GoogleGenerativeAI, type EmbedContentRequest } from '@google/generative-ai';

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

export async function embeddingSimilarity({
	prompt,
	targetDescription,
	apiKey,
	useVision = true,
}: {
	prompt: string;
	targetDescription: string;
	apiKey?: string;
	useVision?: boolean;
}): Promise<number | null> {
	if (!apiKey) return null;
	const genAI = new GoogleGenerativeAI(apiKey);
	// Prefer multimodal embeddings if available; fallback to text embeddings
	const modelId = useVision ? 'multimodalembedding' : 'text-embedding-004';
	const model = genAI.getGenerativeModel({ model: modelId as any });
	const requests: EmbedContentRequest[] = [
		{ content: { role: 'user', parts: [{ text: prompt }] } as any },
		{ content: { role: 'user', parts: [{ text: targetDescription }] } as any },
	];
	const res = await model.batchEmbedContents({ requests } as any);
	// SDK returns embeddings[] with values[]
	// @ts-ignore - SDK types are lax
	const vectors: number[][] = res.embeddings.map((e: any) => e.values as number[]);
	if (!vectors?.[0] || !vectors?.[1]) return null;
	return cosineSimilarity(vectors[0], vectors[1]);
}

export function computeFinalScore(similarity01: number, heuristicBonus: number): number {
	// Convert similarity [0,1] -> 0..100 then add bonus (capped)
	const base = Math.max(0, Math.min(100, similarity01 * 100));
	return Math.max(0, Math.min(100, base + heuristicBonus));
}


