// app/api/test-vertex/route.ts
import { embedImagesBase64 } from '@/lib/vertex';

export const runtime = 'nodejs';

export async function GET() {
	try {
		const testImg =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
		const [vec] = await embedImagesBase64([testImg]);
		return Response.json({ success: true, dim: vec.length });
	} catch (e: any) {
		return Response.json({ success: false, error: e.message }, { status: 500 });
	}
}


