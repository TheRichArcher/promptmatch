import { GoogleAuth } from 'google-auth-library';
import crypto from 'crypto';

const PROJECT_ID = process.env.VERTEX_PROJECT_ID;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL_PATH = PROJECT_ID
	? `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/multimodalembedding@001`
	: null;
const PREDICT_URL = MODEL_PATH ? `https://${LOCATION}-aiplatform.googleapis.com/v1/${MODEL_PATH}:predict` : null;

// Cache embeddings by sha256 of raw bytes (base64) to avoid recompute
const imageEmbeddingCache = new Map<string, number[]>();
let initialized = false;

export function stripDataUrl(b64OrDataUrl: string): string {
	return b64OrDataUrl.replace(/^data:image\/\w+;base64,/, '');
}

function normalizeBase64(input: string): string {
	// Support URL-safe base64 variants
	let s = input.replace(/-/g, '+').replace(/_/g, '/');
	// Remove whitespace/newlines
	s = s.replace(/\s+/g, '');
	// Pad to multiple of 4
	const pad = s.length % 4;
	if (pad === 2) s += '==';
	else if (pad === 3) s += '=';
	else if (pad === 1) {
		// Invalid base64 length; better to throw than send bad payload
		throw new Error('Invalid base64 input length');
	}
	return s;
}

export function decodeBase64ToBuffer(b64OrDataUrl: string): Buffer {
	const raw = stripDataUrl(b64OrDataUrl);
	const normalized = normalizeBase64(raw);
	return Buffer.from(normalized, 'base64');
}

export function dataUrlApproxBytes(b64OrDataUrl: string): number {
	try {
		return decodeBase64ToBuffer(b64OrDataUrl).byteLength;
	} catch {
		// Fallback: Base64 size approximation: 3/4 of length (ignoring padding)
		const b64 = stripDataUrl(b64OrDataUrl);
		return Math.floor((b64.length * 3) / 4);
	}
}

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export async function getAccessToken(): Promise<string> {
	if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
		return cachedToken;
	}

	let credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
	if (!credsJson && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_B64) {
		try {
			credsJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_B64, 'base64').toString('utf-8');
		} catch (e) {
			throw new Error('Failed to decode B64 credentials: ' + (e as Error).message);
		}
	}
	if (!credsJson) {
		throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON or _B64');
	}

	let credentials: any;
	try {
		credentials = JSON.parse(credsJson);
	} catch (e) {
		throw new Error('Invalid JSON in credentials: ' + (e as Error).message);
	}

	const auth = new GoogleAuth({
		credentials,
		scopes: ['https://www.googleapis.com/auth/cloud-platform'],
	});
	const client = await auth.getClient();
	const tokenResponse = await client.getAccessToken();
	if (!tokenResponse?.token) {
		throw new Error('Failed to get access token from Google');
	}
	cachedToken = tokenResponse.token;
	tokenExpiry = Date.now() + 3_500_000; // ~58 min
	return cachedToken;
}

type FetchOpts = {
	method?: 'POST' | 'GET';
	headers?: Record<string, string>;
	body?: string;
	timeoutMs?: number;
	retries?: number;
};

async function fetchJsonWithTimeoutRetry(url: string, { method = 'POST', headers = {}, body, timeoutMs = 15_000, retries = 2 }: FetchOpts) {
	let attempt = 0;
	let lastError: any = null;
	while (attempt <= retries) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, {
				method,
				headers,
				body,
				signal: controller.signal,
			});
			clearTimeout(timer);
			const text = await res.text();
			if (!res.ok) {
				// Retry on 429 and 5xx
				if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
					lastError = new Error(`Vertex API ${res.status}: ${text.substring(0, 200)}`);
					await new Promise((r) => setTimeout(r, jitterDelay(attempt)));
					attempt++;
					continue;
				}
				throw new Error(`Vertex API ${res.status}: ${text.substring(0, 200)}`);
			}
			let json: any;
			try {
				json = JSON.parse(text);
			} catch {
				throw new Error(`vertex json parse: ${text}`);
			}
			return json;
		} catch (e: any) {
			clearTimeout(timer);
			// Retry on abort or network error
			const message = String(e?.message || e);
			if (message.includes('AbortError') || message.includes('network')) {
				lastError = e;
				await new Promise((r) => setTimeout(r, jitterDelay(attempt)));
				attempt++;
				continue;
			}
			throw e;
		}
	}
	throw lastError || new Error('vertex predict failed after retries');
}

function jitterDelay(attempt: number): number {
	const base = Math.min(1000 * 2 ** attempt, 4000);
	return base + Math.floor(Math.random() * 250);
}

function parseEmbeddingVectors(json: any): number[][] {
	function isNumericArray(arr: any): arr is number[] {
		return Array.isArray(arr) && arr.length > 0 && arr.every((x) => typeof x === 'number');
	}
	function findFirstNumericArrayDeep(node: any): number[] | null {
		if (!node || typeof node !== 'object') return null;
		// If node has a 'values' or 'floatValues' that is numeric, prefer those
		if (isNumericArray(node?.values)) return node.values;
		if (isNumericArray(node?.floatValues)) return node.floatValues;
		// Direct numeric array
		if (isNumericArray(node)) return node;
		if (Array.isArray(node)) {
			for (const child of node) {
				const found = findFirstNumericArrayDeep(child);
				if (found) return found;
			}
		} else {
			for (const key of Object.keys(node)) {
				const found = findFirstNumericArrayDeep(node[key]);
				if (found) return found;
			}
		}
		return null;
	}
	// Handle shapes:
	// A) { predictions: [ { embeddings: { imageEmbedding: { values: [...] } } } ] }
	// B) { predictions: [ { embeddings: { values: [...] } } ] }
	// C) { predictions: [ { embeddings: [ { values: [...] } ] } ] }
	// D) { predictions: [ { imageEmbedding: { values: [...] } } ] }
	// E) { predictions: [ { imageEmbedding: [...] } ] }
	// F) { predictions: [ { embeddings: { imageEmbedding: [...] } } ] }
	// G) snake_case variants with values/floatValues
	const preds = Array.isArray(json?.predictions) ? json.predictions : Array.isArray(json?.outputs) ? json.outputs : [];
	const vectors: number[][] = [];
	for (const p of preds) {
		const candidates = [
			p?.embeddings?.imageEmbedding?.values,
			p?.embeddings?.imageEmbedding?.floatValues,
			p?.embeddings?.values,
			Array.isArray(p?.embeddings) ? p.embeddings?.[0]?.values : undefined,
			p?.imageEmbedding?.values,
			p?.imageEmbedding?.floatValues,
			// Direct arrays without .values
			Array.isArray(p?.imageEmbedding) ? p.imageEmbedding : undefined,
			Array.isArray(p?.embeddings?.imageEmbedding) ? p.embeddings.imageEmbedding : undefined,
			// snake_case keys
			p?.embeddings?.image_embedding?.values,
			p?.embeddings?.image_embedding?.floatValues,
			p?.image_embedding?.values,
			p?.image_embedding?.floatValues,
			Array.isArray(p?.embeddings)
				? (p.embeddings?.[0]?.imageEmbedding?.values ??
						p.embeddings?.[0]?.imageEmbedding?.floatValues ??
						p.embeddings?.[0]?.image_embedding?.values ??
						p.embeddings?.[0]?.image_embedding?.floatValues)
				: undefined,
		].filter(Boolean);
		const vec = candidates[0];
		if (Array.isArray(vec)) {
			vectors.push(vec as number[]);
			continue;
		}
		// Fallback: deep search for first numeric array (e.g., unknown nesting)
		const fallback = findFirstNumericArrayDeep(p);
		if (fallback) {
			vectors.push(fallback);
		}
	}
	return vectors;
}

export async function embedImagesBase64Batch(dataUrlsOrBase64: string[]): Promise<number[][]> {
	const token = await getAccessToken();

	if (!PROJECT_ID || !LOCATION) {
		throw new Error('VERTEX_PROJECT_ID and VERTEX_LOCATION must be configured');
	}
	const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/multimodalembedding@001:predict`;

	// The Vertex model rejects multiple instances in one request.
	// Send one request per image and collect vectors.
	const results = await Promise.all(
		dataUrlsOrBase64.map(async (img, idx) => {
			const body = JSON.stringify({
				instances: [{ image: { bytesBase64Encoded: stripDataUrl(img) } }],
			});
			try {
				const res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body,
				});
				const text = await res.text();
				if (!res.ok) {
					throw new Error(`Vertex API ${res.status}: ${text.substring(0, 200)}`);
				}
				let data: any;
				try {
					data = JSON.parse(text);
				} catch {
					throw new Error(`vertex json parse: ${text}`);
				}
				const vectors = parseEmbeddingVectors(data);
				if (!vectors[0]) {
					throw new Error('vertex predict: no vector in response');
				}
				return vectors[0];
			} catch (e: any) {
				throw e;
			}
		})
	);
	return results;
}

export async function embedImageBase64(dataUrlOrBase64: string): Promise<number[]> {
	const [vec] = await embedImagesBase64Batch([dataUrlOrBase64]);
	return vec;
}

// Convenience alias to match expected import name in tests
export async function embedImagesBase64(images: string[]): Promise<number[][]> {
	if (images.length === 0) throw new Error('No images');
	if (images.length === 1) images = [images[0], images[0]];
	return await embedImagesBase64Batch(images);
}

export function cosineSimilarity(a: number[], b: number[]) {
	if (!a?.length || !b?.length || a.length !== b.length) return 0;
	let dot = 0,
		na = 0,
		nb = 0;
	for (let i = 0; i < a.length; i++) {
		const x = a[i],
			y = b[i];
		dot += x * y;
		na += x * x;
		nb += y * y;
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom ? dot / denom : 0;
}

function sha256Base64(inputBase64: string): string {
	return crypto.createHash('sha256').update(stripDataUrl(inputBase64), 'base64').digest('hex');
}

export async function getOrComputeImageEmbeddingCached(dataUrlOrBase64: string): Promise<number[]> {
	const key = sha256Base64(dataUrlOrBase64);
	const cached = imageEmbeddingCache.get(key);
	if (cached) return cached;
	const vec = await embedImageBase64(dataUrlOrBase64);
	imageEmbeddingCache.set(key, vec);
	return vec;
}

export async function initTargetEmbeddings(): Promise<void> {
	if (initialized) return;
	initialized = true;
	console.log('[vertex] Cache warmup initialized');
	// Optionally: seed known targets here by reading from public/ if present.
	// In absence of static assets, cache will warm on first request using provided target images.
}


