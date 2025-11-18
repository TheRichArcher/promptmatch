const cache: Record<string, string> = {};

export async function generateAndCacheImage(prompt: string, key: string): Promise<string> {
	if (cache[key]) return cache[key];

	// Use existing generate API endpoint
	// For server-side, construct the base URL
	// In production, prefer NEXT_PUBLIC_BASE_URL, fallback to localhost for dev
	let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (!baseUrl && process.env.VERCEL_URL) {
		baseUrl = `https://${process.env.VERCEL_URL}`;
	}
	if (!baseUrl && process.env.RENDER_EXTERNAL_URL) {
		// RENDER_EXTERNAL_URL may already include protocol
		baseUrl = process.env.RENDER_EXTERNAL_URL.startsWith('http') 
			? process.env.RENDER_EXTERNAL_URL 
			: `https://${process.env.RENDER_EXTERNAL_URL}`;
	}
	if (!baseUrl) {
		baseUrl = 'http://localhost:3000';
	}
	
	const res = await fetch(`${baseUrl}/api/generate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ prompt }),
	});

	if (!res.ok) {
		throw new Error(`Failed to generate image: ${res.status}`);
	}

	const data = await res.json();
	const imageUrl = data.imageDataUrl || data.image;

	if (!imageUrl) {
		throw new Error('No image URL in response');
	}

	cache[key] = imageUrl;
	return imageUrl;
}

