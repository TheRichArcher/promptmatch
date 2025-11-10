import { NextRequest, NextResponse } from 'next/server';

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
			return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
		}

		if (!process.env.GOOGLE_API_KEY) {
			console.error('[generate] Missing GOOGLE_API_KEY');
			return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
		}

		console.log('[generate] Gemini images request');
		const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
		const candidateModels = ['gemini-2.5-flash-image', 'gemini-2.5-flash'];

		let dataUrl: string | null = null;
		let lastError: unknown = null;
		for (const modelId of candidateModels) {
			try {
				console.log('[generate] Trying model:', modelId);
				const model = genAI.getGenerativeModel({ model: modelId as any });
				const result = await model.generateContent({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
				} as any);
				const response = (result as any).response ?? (await (result as any).response);
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
				const topLevelParts = (response?.parts ?? []) as any[];
				dataUrl = extractImageDataUrl(topLevelParts);
				if (dataUrl) break;
				lastError = new Error('No image data returned by model response');
			} catch (e) {
				lastError = e;
				console.error('[generate] Gemini error for model', modelId, (e as any)?.message ?? e);
				continue;
			}
		}

		if (!dataUrl) {
			const message = lastError instanceof Error ? lastError.message : 'Failed to generate image';
			return NextResponse.json({ error: 'Gemini request failed', details: message }, { status: 502 });
		}

		return NextResponse.json({ image: dataUrl, imageDataUrl: dataUrl, provider: 'gemini' }, { status: 200 });
	} catch (err: any) {
		console.error('[generate] Unhandled error:', err?.message ?? err);
		return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
	}
}


