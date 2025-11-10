import { GoogleGenerativeAI, type EmbedContentRequest } from '@google/generative-ai';
import { getGoogleAccessTokenFromEnv } from './googleAuth';

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

export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
	if (!dataUrl.startsWith('data:')) return null;
	const firstComma = dataUrl.indexOf(',');
	if (firstComma === -1) return null;
	const header = dataUrl.substring(5, firstComma); // e.g., image/png;base64
	const base64 = dataUrl.substring(firstComma + 1);
	const mime = header.split(';')[0] || 'image/png';
	return { mime, base64 };
}

export async function embeddingSimilarityForImages({
	targetImageDataUrl,
	generatedImageDataUrl,
	apiKey,
}: {
	targetImageDataUrl: string;
	generatedImageDataUrl: string;
	apiKey?: string;
}): Promise<number | null> {
	const target = parseDataUrl(targetImageDataUrl);
	const generated = parseDataUrl(generatedImageDataUrl);
	if (!target || !generated) return null;

	// Use the public REST endpoint for embedding-001 batch image embedding with Bearer auth
	const url = 'https://generativelanguage.googleapis.com/v1/models/embedding-001:batchEmbedContents';
	const payload = {
		requests: [
			{
				model: 'models/embedding-001',
				content: {
					parts: [{ inline_data: { mime_type: target.mime, data: target.base64 } }],
				},
			},
			{
				model: 'models/embedding-001',
				content: {
					parts: [{ inline_data: { mime_type: generated.mime, data: generated.base64 } }],
				},
			},
		],
	};
	// Prefer service-account OAuth if provided; otherwise fall back to API key via query param
	const accessToken = await getGoogleAccessTokenFromEnv();
	const finalUrl =
		accessToken || !apiKey ? url : `${url}?key=${encodeURIComponent(apiKey)}`;
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

	const res = await fetch(finalUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		// Surface error so caller can record errorMessage and fallback accordingly
		const text = await res.text();
		throw new Error(`embedding-001 ${res.status}: ${text}`);
	}
	const data: any = await res.json();
	// Some SDKs wrap JSON as {data: {...}}; support both
	const root = data?.data?.embeddings ? data.data : data;
	const embeddings = root?.embeddings;
	if (!Array.isArray(embeddings) || embeddings.length < 2) return null;
	const vec = (e: any): number[] | null => {
		if (Array.isArray(e?.values)) return e.values as number[];
		if (Array.isArray(e?.embedding?.values)) return e.embedding.values as number[];
		return null;
	};
	const v0 = vec(embeddings[0]);
	const v1 = vec(embeddings[1]);
	if (!v0 || !v1) return null;
	return cosineSimilarity(v0, v1);
}


