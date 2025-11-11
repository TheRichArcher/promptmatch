// app/api/test-vertex/route.ts
import { embedImagesBase64 } from '@/lib/vertex';

export const runtime = 'nodejs';

export async function GET() {
	try {
		// Use the same 1x1 pixel twice
		const testImg =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

		// MUST PASS 2+ IMAGES
		const vectors = await embedImagesBase64([testImg, testImg]);
		if (vectors.length === 0) throw new Error('No vectors returned');

		return Response.json({ success: true, dim: vectors[0].length });
	} catch (e: any) {
		return Response.json({ success: false, error: e.message }, { status: 500 });
	}
}


