const cache: Record<string, string> = {};

export async function generateAndCacheImage(prompt: string, key: string): Promise<string> {
	if (cache[key]) return cache[key];

	// Use existing Gemini call from /api/generate
	// For server-side, we need an absolute URL
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
		|| (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
		|| (process.env.RENDER_EXTERNAL_URL ? (process.env.RENDER_EXTERNAL_URL.startsWith('http') ? process.env.RENDER_EXTERNAL_URL : `https://${process.env.RENDER_EXTERNAL_URL}`) : null)
		|| 'http://localhost:3000';

	const res = await fetch(`${baseUrl}/api/generate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ prompt }),
	});

	const data = await res.json();
	const imageUrl = data.imageDataUrl || data.image;

	cache[key] = imageUrl;
	return imageUrl;
}

