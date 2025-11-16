import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

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

function hashString(input: string): number {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = Math.imul(31, h) + input.charCodeAt(i);
		h |= 0;
	}
	return Math.abs(h);
}

function buildPlaceholderSvg(prompt: string): string {
	const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
	const idx = hashString(prompt) % colors.length;
	const color = colors[idx];
	const shape = hashString(prompt + 'shape') % 2 === 0 ? 'circle' : 'rect';
	const safeText = prompt.replace(/[<>&"]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m] as string));
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
		`<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f8fafc"/></linearGradient></defs>` +
		`<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>` +
		(shape === 'circle'
			? `<circle cx="256" cy="256" r="140" fill="${color}" />`
			: `<rect x="146" y="146" width="220" height="220" rx="24" fill="${color}" />`) +
		`<text x="256" y="440" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="20" text-anchor="middle" fill="#334155" opacity="0.85">Demo image for: ${safeText.substring(0, 42)}</text>` +
		`</svg>`;
	const b64 = Buffer.from(svg, 'utf8').toString('base64');
	return `data:image/svg+xml;base64,${b64}`;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const prompt = String(body?.prompt ?? '');
		const tier = String(body?.tier ?? '').toLowerCase();
		// For Easy tier, lightly constrain to a flat 2D icon to avoid photoreal outputs
		const effectivePrompt =
			tier === 'easy' && prompt
				? `simple 2D ${prompt} icon on white background`
				: prompt;
		if (!prompt) {
			return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
		}

		// If no API key, return a deterministic placeholder so flows still work in demo/prod without keys
		if (!process.env.GOOGLE_API_KEY) {
			const placeholder = buildPlaceholderSvg(effectivePrompt);
			return NextResponse.json({ image: placeholder, imageDataUrl: placeholder, provider: 'placeholder' }, { status: 200 });
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
					contents: [{ role: 'user', parts: [{ text: effectivePrompt }] }],
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


