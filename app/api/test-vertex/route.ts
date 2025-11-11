// app/api/test-vertex/route.ts
import { embedImagesBase64, getAccessToken } from '@/lib/vertex';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const debug = url.searchParams.get('debug');
		// Use the same 1x1 pixel twice
		const testImg =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

		if (debug) {
			// Diagnostic path: call Vertex directly with one image and return raw predictions
			const PROJECT_ID = process.env.VERTEX_PROJECT_ID;
			const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
			if (!PROJECT_ID) {
				throw new Error('Missing VERTEX_PROJECT_ID');
			}
			const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/multimodalembedding@001:predict`;
			const token = await getAccessToken();
			const body = JSON.stringify({
				instances: [{ image: { bytesBase64Encoded: testImg.split(',')[1] } }],
			});
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body,
			});
			const text = await res.text();
			let json: any = null;
			try {
				json = JSON.parse(text);
			} catch {
				// keep raw text if not json
			}
			return Response.json({
				success: res.ok,
				status: res.status,
				predictions: json?.predictions ?? null,
				rawPreview: text.substring(0, 800),
			});
		}

		// MUST PASS 2+ IMAGES (library will also duplicate when needed)
		const vectors = await embedImagesBase64([testImg, testImg]);
		if (vectors.length === 0) throw new Error('No vectors returned');

		return Response.json({ success: true, dim: vectors[0].length });
	} catch (e: any) {
		return Response.json({ success: false, error: e.message }, { status: 500 });
	}
}


