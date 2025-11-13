import { NextRequest, NextResponse } from 'next/server';
import { selectRandomTargets } from '@/lib/trainingTargets';
import type { Tier } from '@/lib/tiers';
import { clearUsedImages, fileToDataUrl, pickUniqueImagesWithFallback } from '@/lib/tieredTargets';
import { sealGoldPrompt } from '@/lib/secureText';

export const runtime = 'nodejs';

function resolveBaseUrl(req: NextRequest): string {
	const envUrl = process.env.NEXT_PUBLIC_URL;
	if (envUrl) return envUrl.replace(/\/+$/, '');
	const proto = req.headers.get('x-forwarded-proto') ?? 'http';
	const host = req.headers.get('host') ?? 'localhost:3000';
	return `${proto}://${host}`;
}

// Normalize/clean gold prompt text for natural phrasing
function cleanGoldPrompt(input: string): string {
	let s = String(input || '').replace(/\s+/g, ' ').trim();
	if (!s) return s;
	// If short phrase with "with" but no other prepositions, collapse "with"
	const hasWith = /\bwith\b/i.test(s);
	const hasOtherPrep = /\b(of|on|in|at|under|over|near|by|from|into)\b/i.test(s);
	const wordCount = s.split(/\s+/).length;
	if (hasWith && !hasOtherPrep && wordCount <= 4) {
		s = s.replace(/\bwith\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
	}
	// Fallback: collapse trailing "with X" to " X"
	s = s.replace(/^(.+?)\swith\s([a-z0-9-]+)$/i, '$1 $2');
	// Article fixups
	s = s.replace(/\ba ([aeiou])/gi, 'an $1').replace(/\ban ([^aeiou])/gi, 'a $1');
	return s;
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
		const { picks, usedTier } = await pickUniqueImagesWithFallback(projectRoot, tier, 5);
		if (picks.length > 0) {
			const targets = picks.map(({ abs, label }) => {
				const goldToken = sealGoldPrompt(cleanGoldPrompt(label));
				return {
					goldToken,
					imageDataUrl: fileToDataUrl(abs),
				};
			});
			const notice =
				tier === 'expert' && usedTier !== tier
					? "Expert tier coming soon! You’ve mastered all current challenges."
					: undefined;
			return NextResponse.json({ targets, tier, notice }, { status: 200 });
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
				return { goldToken: sealGoldPrompt(cleanGoldPrompt(prompt)), imageDataUrl };
			}),
		);

		return NextResponse.json({ targets, tier }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


