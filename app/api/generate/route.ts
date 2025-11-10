import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

type ImagePart = {
	inlineData?: { data?: string; mimeType?: string };
	inline_data?: { data?: string; mime_type?: string };
};

function extractImageDataUrl(parts: any[]): string | null {
	if (!Array.isArray(parts)) return null;
	for (const p of parts as ImagePart[]) {
		const inline =
			(p as any)?.inlineData ||
			(p as any)?.inline_data ||
			null;
		const data: string | undefined = inline?.data;
		const mime: string | undefined = (inline as any)?.mimeType || (inline as any)?.mime_type;
		if (data && (mime?.startsWith('image/') ?? false)) {
			return `data:${mime};base64,${data}`;
		}
	}
	return null;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const prompt = String(body?.prompt ?? '');
		if (!prompt) {
			return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400 });
		}

		// Runtime key presence check (no build-time/env caching)
		const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0);
		const hasGoogle = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 0);
		if (!hasOpenAI && !hasGoogle) {
			return NextResponse.json({ error: 'No API key available' }, { status: 500 });
		}

		console.log('[generate] Incoming request (OpenAI primary)');
		console.log('[generate] Prompt length:', prompt.length);

		// 1) Try OpenAI (primary)
		const openaiKey = process.env.OPENAI_API_KEY;
		let openaiError: string | null = null;
		if (openaiKey) {
			try {
				const openai = new OpenAI({ apiKey: openaiKey });
				const img = await openai.images.generate({
					model: 'gpt-image-1',
					prompt,
					size: '512x512',
					quality: 'standard',
				});
				const b64 = img.data?.[0]?.b64_json;
				if (b64) {
					const dataUrl = `data:image/png;base64,${b64}`;
					return new Response(JSON.stringify({ image: dataUrl, imageDataUrl: dataUrl, provider: 'openai' }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				}
				console.warn('[generate] OpenAI returned no b64_json');
				openaiError = 'OpenAI returned no image (no b64_json).';
			} catch (e: any) {
				console.error('[generate] OpenAI error:', e?.message ?? e);
				openaiError = e?.message ?? String(e);
			}
		} else {
			console.warn('[generate] OPENAI_API_KEY not set, skipping OpenAI generation');
			openaiError = 'OPENAI_API_KEY not set';
		}

		// 2) Fallback to Gemini if available
		const googleKey = process.env.GOOGLE_API_KEY;
		let dataUrl: string | null = null;
		let lastError: unknown = null;
		let geminiError: string | null = null;
		if (googleKey) {
			const genAI = new GoogleGenerativeAI(googleKey);
			const candidateModels = ['gemini-2.5-flash-image', 'gemini-2.5-flash'];
			for (const modelId of candidateModels) {
				try {
					console.log('[generate] Trying Gemini model:', modelId);
					const model = genAI.getGenerativeModel({ model: modelId as any });
					const result = await model.generateContent({
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
					} as any);
					const response = (result as any).response ?? (await (result as any).response);
					const candidates = (response?.candidates ?? []) as any[];
					console.log('[generate] Gemini candidates count:', candidates?.length ?? 0);
					for (const c of candidates) {
						const parts = c?.content?.parts ?? [];
						const maybe = extractImageDataUrl(parts);
						if (maybe) {
							console.log('[generate] Found inline image data in candidates');
							dataUrl = maybe;
							break;
						}
					}
					if (dataUrl) break;
					const topLevelParts = (response?.parts ?? []) as any[];
					dataUrl = extractImageDataUrl(topLevelParts);
					if (dataUrl) {
						console.log('[generate] Found inline image data at top-level parts');
						break;
					}
					lastError = new Error('No image data returned by model response');
					console.warn('[generate] No image data for model:', modelId);
				} catch (e) {
					lastError = e;
					console.error('[generate] Gemini model attempt failed:', modelId, (e as any)?.message ?? e);
					geminiError = (e as any)?.message ?? String(e);
					continue;
				}
			}
			if (dataUrl) {
				return new Response(JSON.stringify({ image: dataUrl, imageDataUrl: dataUrl, provider: 'gemini' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			const message = lastError instanceof Error ? lastError.message : 'Failed to generate image';
			console.error('[generate] All Gemini attempts failed:', message);
			geminiError = geminiError ?? message;
		} else {
			console.warn('[generate] GOOGLE_API_KEY not set; Gemini fallback unavailable');
			geminiError = 'GOOGLE_API_KEY not set';
		}

		return new Response(JSON.stringify({
			error: 'Image generation unavailable. Set OPENAI_API_KEY or GOOGLE_API_KEY.',
			details: { openaiError, geminiError }
		}), { status: 502, headers: { 'Content-Type': 'application/json' } });
	} catch (err: any) {
		console.error('[generate] Unhandled error:', err?.message ?? err);
		return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
	}
}


