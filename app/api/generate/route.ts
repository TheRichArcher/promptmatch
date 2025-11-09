import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

		const apiKey = process.env.GOOGLE_API_KEY;
		if (!apiKey) {
			return new Response(JSON.stringify({ error: 'Missing GOOGLE_API_KEY server configuration' }), { status: 500 });
		}

		const genAI = new GoogleGenerativeAI(apiKey);
		// Try likely model ids for Gemini 2.5 Flash Image. Fall back gracefully.
		const candidateModels = [
			'gemini-2.5-flash-image',
			'gemini-2.5-flash',
			'gemini-1.5-flash',
		];

		let dataUrl: string | null = null;
		let lastError: unknown = null;

		for (const modelId of candidateModels) {
			try {
				const model = genAI.getGenerativeModel({ model: modelId as any });
				// Request an image response; SDKs differ in naming, so pass both hints.
				const result = await model.generateContent({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					// @ts-ignore - some SDK versions accept responseMimeType
					generationConfig: { responseMimeType: 'image/png', response_mime_type: 'image/png' },
				} as any);
				const response = await (result as any).response;
				const candidates = (response?.candidates ?? []) as any[];
				for (const c of candidates) {
					const parts = c?.content?.parts ?? [];
					const maybe = extractImageDataUrl(parts);
					if (maybe) {
						dataUrl = maybe;
						break;
					}
				}
				if (dataUrl) break;
				// Some SDKs return inline data on response.promptFeedback or top-level—scan conservatively
				const topLevelParts = (response?.parts ?? []) as any[];
				dataUrl = extractImageDataUrl(topLevelParts);
				if (dataUrl) break;
				lastError = new Error('No image data returned by model');
			} catch (e) {
				lastError = e;
				continue;
			}
		}

		if (!dataUrl) {
			const message =
				lastError instanceof Error ? lastError.message : 'Failed to generate image';
			return new Response(JSON.stringify({ error: message }), { status: 502 });
		}

		return new Response(JSON.stringify({ image: dataUrl, imageDataUrl: dataUrl }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
	}
}


