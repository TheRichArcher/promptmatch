import { NextRequest, NextResponse } from 'next/server';
import { selectRandomTargets } from '@/lib/trainingTargets';

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
		const prompts = selectRandomTargets(5);
		const baseUrl = resolveBaseUrl(req);

		const targets = await Promise.all(
			prompts.map(async (prompt) => {
				const res = await fetch(`${baseUrl}/api/generate`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt }),
					// Avoid Next.js fetch caching for dynamic generation
					next: { revalidate: 0 },
				});
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data?.error || 'Failed to generate image');
				}
				const imageDataUrl: string | null = data?.image ?? data?.imageDataUrl ?? null;
				if (!imageDataUrl) {
					throw new Error('No image data returned from /api/generate');
				}
				return {
					prompt,
					imageDataUrl,
				};
			}),
		);

		return NextResponse.json({ targets }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


