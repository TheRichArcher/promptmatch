import { NextRequest, NextResponse } from 'next/server';
import { unsealGoldPrompt } from '@/lib/secureText';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const tokens: string[] = Array.isArray(body?.tokens) ? body.tokens.filter((t: any) => typeof t === 'string') : [];

		const allowed = String(process.env.SHOW_GOLD_PROMPTS_AFTER_TRAIN || '').toLowerCase() === 'true';
		if (!allowed) {
			// Return shape without revealing prompts
			return NextResponse.json({ allowed: false, goldPrompts: Array(tokens.length).fill(null) }, { status: 200 });
		}

		const goldPrompts: (string | null)[] = tokens.map((tok) => {
			try {
				return unsealGoldPrompt(tok);
			} catch {
				return null;
			}
		});
		return NextResponse.json({ allowed: true, goldPrompts }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


