import { NextRequest, NextResponse } from 'next/server';
import { selectRandomTargets } from '@/lib/trainingTargets';
import type { Tier } from '@/lib/tiers';
import { clearUsedImages, fileToDataUrl, pickUniqueImages } from '@/lib/tieredTargets';

export const runtime = 'nodejs';

function resolveBaseUrl(req: NextRequest): string {
	const envUrl = process.env.NEXT_PUBLIC_URL;
	if (envUrl) return envUrl.replace(/\/+$/, '');
	const proto = req.headers.get('x-forwarded-proto') ?? 'http';
	const host = req.headers.get('host') ?? 'localhost:3000';
	return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const tier: Tier = (body?.tier as Tier) || 'medium';
		const resetUsed = Boolean(body?.resetUsed);
		if (resetUsed) {
			clearUsedImages();
		}

		// Prefer tiered image pools if available
		const projectRoot = process.cwd();
		const picks = await pickUniqueImages(projectRoot, tier, 5);
		if (picks.length > 0) {
			const targets = picks.map(({ abs, label }) => ({
				prompt: label, // lightweight description derived from filename
				imageDataUrl: fileToDataUrl(abs),
			}));
			return NextResponse.json({ targets, tier }, { status: 200 });
		}

		// Fallback: generate on the fly using text prompts
		const prompts = selectRandomTargets(5);
		const baseUrl = resolveBaseUrl(req);
		const targets = await Promise.all(
			prompts.map(async (prompt) => {
				const res = await fetch(`${baseUrl}/api/generate`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt }),
					next: { revalidate: 0 },
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data?.error || 'Failed to generate image');
				const imageDataUrl: string | null = data?.image ?? data?.imageDataUrl ?? null;
				if (!imageDataUrl) throw new Error('No image data returned from /api/generate');
				return { prompt, imageDataUrl };
			}),
		);

		return NextResponse.json({ targets, tier }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


