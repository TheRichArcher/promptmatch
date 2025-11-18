const cache: Record<string, string> = {};

export async function generateAndCacheImage(prompt: string, key: string): Promise<string> {
	if (cache[key]) return cache[key];

	// Use existing Gemini call from /api/generate
	// For server-side, prefer localhost to avoid external URL issues on Render/Vercel
	// Only use external URL if explicitly set via NEXT_PUBLIC_BASE_URL
	const port = process.env.PORT || '3000';
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
		|| (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL ? `http://localhost:${port}` : null)
		|| (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
		|| (process.env.RENDER_EXTERNAL_URL ? (process.env.RENDER_EXTERNAL_URL.startsWith('http') ? process.env.RENDER_EXTERNAL_URL : `https://${process.env.RENDER_EXTERNAL_URL}`) : null)
		|| `http://localhost:${port}`;
	
	// eslint-disable-next-line no-console
	console.log('[generateAndCacheImage] Using baseUrl:', baseUrl);

	try {
		// Add timeout to prevent hanging requests
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

		const res = await fetch(`${baseUrl}/api/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ prompt }),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!res.ok) {
			const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
			throw new Error(`Failed to generate image: ${errorData.error || res.statusText}`);
		}

		const data = await res.json();
		const imageUrl = data.imageDataUrl || data.image;

		if (!imageUrl) {
			throw new Error('No image data returned from generate endpoint');
		}

		cache[key] = imageUrl;
		return imageUrl;
	} catch (err: any) {
		console.error('[generateAndCacheImage] Error:', err?.message ?? err);
		if (err.name === 'AbortError') {
			throw new Error('Image generation request timed out');
		}
		throw err;
	}
}

