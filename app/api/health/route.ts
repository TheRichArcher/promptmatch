import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
	try {
		const googleHasKey = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 0);
		const openaiHasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0);
		return new Response(JSON.stringify({
			ok: true,
			keys: { googleHasKey, openaiHasKey },
			env: { NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? null }
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ ok: false, error: err?.message ?? 'Unknown error' }), { status: 500 });
	}
}


