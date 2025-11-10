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

		if (!process.env.OPENAI_API_KEY) {
			console.error('[generate] Missing OPENAI_API_KEY');
			return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
		}

		console.log('[generate] OpenAI images request');
		const res = await fetch('https://api.openai.com/v1/images/generations', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-image-1',
				prompt,
				size: '1024x1024',
				quality: 'high',
			}),
		});

		const text = await res.text();
		if (!res.ok) {
			console.error('[generate] OpenAI error:', text);
			return NextResponse.json({ error: 'OpenAI request failed', details: text }, { status: res.status });
		}

		let data: any = null;
		try {
			data = JSON.parse(text);
		} catch {
			console.error('[generate] Non-JSON success response from OpenAI');
			return NextResponse.json({ error: 'Unexpected response from OpenAI', details: text }, { status: 502 });
		}

		const base64 = data?.data?.[0]?.b64_json;
		if (!base64) {
			return NextResponse.json({ error: 'No image data returned', details: data }, { status: 502 });
		}

		const dataUrl = `data:image/png;base64,${base64}`;
		return NextResponse.json({ image: dataUrl, imageDataUrl: dataUrl, provider: 'openai' }, { status: 200 });
	} catch (err: any) {
		console.error('[generate] Unhandled error:', err?.message ?? err);
		return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
	}
}


