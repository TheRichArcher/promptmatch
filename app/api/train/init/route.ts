import { NextRequest, NextResponse } from 'next/server';
import { selectRandomTargets } from '@/lib/trainingTargets';
import type { Tier } from '@/lib/tiers';
import { clearUsedImages, fileToDataUrl, getPoolForTier, pickUniqueImagesWithFallback } from '@/lib/tieredTargets';
import { sealGoldPrompt } from '@/lib/secureText';
import { getGenerationPrompt } from '@/lib/autogenTargets';
import { EASY_SEEDS } from '@/lib/tieredTargets';

export const runtime = 'nodejs';

function sseEncode(data: any): string {
	try {
		return `data: ${JSON.stringify(data)}\n\n`;
	} catch {
		return `data: {}\n\n`;
	}
}

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
		const stream: boolean = Boolean(body?.stream);
		const resetUsed = Boolean(body?.resetUsed);
		if (resetUsed) {
			clearUsedImages();
		}

		// HARD OVERRIDE: Basics (easy) must be flat 2D shapes only.
		// We bypass the image pool entirely and return deterministic SVG targets.
		if (tier === 'easy' && !stream) {
			// Shuffle the easy pool and pick 5 unique; auto-generate replacements if fewer than 5 exist
			const seeds = (() => {
				const shuffled = [...EASY_SEEDS].sort(() => Math.random() - 0.5);
				const needed = 5 - Math.min(5, shuffled.length);
				if (needed <= 0) return shuffled.slice(0, 5);
				const COLORS = ['red','blue','green','yellow','orange','pink','black'];
				const SHAPES = ['circle','square','triangle','star','diamond','oval','hexagon'];
				const extra: string[] = [];
				const seen = new Set<string>(shuffled);
				while (extra.length < needed) {
					const color = COLORS[Math.floor(Math.random() * COLORS.length)];
					const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
					const seed = `${color} ${shape}`;
					if (!seen.has(seed)) {
						seen.add(seed);
						extra.push(seed);
					}
				}
				return shuffled.slice(0, Math.min(5, shuffled.length)).concat(extra).slice(0, 5);
			})();
			const targets = seeds.map((seed) => {
				const svg = buildShapeSvg(seed);
				const imageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
				const label = cleanGoldPrompt(seed);
				return {
					goldToken: sealGoldPrompt(label),
					imageDataUrl,
					label,
					tier: 'easy' as const,
				};
			});
			return NextResponse.json({ targets, tier }, { status: 200 });
		}

		// Optional streaming mode for progressive status updates (helps avoid 502 timeouts)
		if (stream) {
			const stream = new ReadableStream({
				async start(controller) {
					const enqueue = (evt: any) => controller.enqueue(new TextEncoder().encode(sseEncode(evt)));
					try {
						enqueue({ status: 'starting', tier });
						// HARD OVERRIDE (stream): Basics (easy) returns deterministic SVG shapes
						if (tier === 'easy') {
							const seeds = (() => {
								const shuffled = [...EASY_SEEDS].sort(() => Math.random() - 0.5);
								const needed = 5 - Math.min(5, shuffled.length);
								if (needed <= 0) return shuffled.slice(0, 5);
								const COLORS = ['red','blue','green','yellow','orange','pink','black'];
								const SHAPES = ['circle','square','triangle','star','diamond','oval','hexagon'];
								const extra: string[] = [];
								const seen = new Set<string>(shuffled);
								while (extra.length < needed) {
									const color = COLORS[Math.floor(Math.random() * COLORS.length)];
									const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
									const seed = `${color} ${shape}`;
									if (!seen.has(seed)) {
										seen.add(seed);
										extra.push(seed);
									}
								}
								return shuffled.slice(0, Math.min(5, shuffled.length)).concat(extra).slice(0, 5);
							})();
							const targets = seeds.map((seed) => {
								const svg = buildShapeSvg(seed);
								const imageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
								const label = cleanGoldPrompt(seed);
								return {
									goldToken: sealGoldPrompt(label),
									imageDataUrl,
									label,
									tier: 'easy' as const,
								};
							});
							enqueue({ status: 'done', targets, tier });
							controller.close();
							return;
						}
						// Prefer tiered image pools if available
						const projectRoot = process.cwd();
						enqueue({ status: 'checking-pool' });
						const initialAdvancedPoolCount =
							tier === 'advanced' ? getPoolForTier(projectRoot, 'advanced').absPaths.length : -1;
						const { picks, usedTier } = await pickUniqueImagesWithFallback(projectRoot, tier, 5);
						if (picks.length > 0) {
							enqueue({ status: 'loaded-pool', usedTier, count: picks.length });
							const targets = picks.map(({ abs, label }) => {
								const goldToken = sealGoldPrompt(cleanGoldPrompt(label));
								return {
									goldToken,
									imageDataUrl: fileToDataUrl(abs),
									label,
									tier: usedTier,
								};
							});
							let notice: string | undefined = undefined;
							if (tier === 'expert' && usedTier !== tier) {
								notice = "Expert tier coming soon! You’ve mastered all current challenges.";
							} else if (tier === 'advanced' && usedTier !== tier) {
								notice = 'Using a lower-tier pool while we build Advanced.';
							} else if (tier === 'advanced' && initialAdvancedPoolCount === 0 && usedTier === 'advanced') {
								notice = 'Generating new Advanced challenge set…';
							}
							enqueue({ status: 'done', targets, tier, notice });
							controller.close();
							return;
						}
						enqueue({ status: 'falling-back-to-generator' });
						const prompts = Array.from({ length: 5 }, () => getGenerationPrompt(tier)) || selectRandomTargets(5);
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
								const label = cleanGoldPrompt(prompt);
								return { goldToken: sealGoldPrompt(label), imageDataUrl, label, tier };
							}),
						);
						enqueue({ status: 'done', targets, tier });
						controller.close();
					} catch (err: any) {
						enqueue({ status: 'error', error: err?.message ?? 'Unknown error' });
						controller.close();
					}
				},
			});
			return new Response(stream, {
				status: 200,
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache, no-transform',
					Connection: 'keep-alive',
					'X-Accel-Buffering': 'no',
				},
			});
		}

		// Prefer tiered image pools if available
		const projectRoot = process.cwd();
		// Observe initial pool state for Advanced to emit a helpful notice
		const initialAdvancedPoolCount =
			tier === 'advanced' ? getPoolForTier(projectRoot, 'advanced').absPaths.length : -1;
		const { picks, usedTier } = await pickUniqueImagesWithFallback(projectRoot, tier, 5);
		if (picks.length > 0) {
			console.log('[train/init]', '✅ Tiered pool loaded', picks.length, 'tier:', usedTier);
			const targets = picks.map(({ abs, label }) => {
				const goldToken = sealGoldPrompt(cleanGoldPrompt(label));
				return {
					goldToken,
					imageDataUrl: fileToDataUrl(abs),
					label,
					tier: usedTier,
				};
			});
			let notice: string | undefined = undefined;
			// If we fell back from the requested tier, let the user know
			if (tier === 'expert' && usedTier !== tier) {
				notice = "Expert tier coming soon! You’ve mastered all current challenges.";
			} else if (tier === 'advanced' && usedTier !== tier) {
				notice = 'Using a lower-tier pool while we build Advanced.';
			} else if (tier === 'advanced' && initialAdvancedPoolCount === 0 && usedTier === 'advanced') {
				notice = 'Generating new Advanced challenge set…';
			}
			return NextResponse.json({ targets, tier, notice }, { status: 200 });
		}

		// Fallback: generate on the fly using text prompts
		console.log('[train/init]', '⚠️ No local images found — falling back to generator', 'requested tier:', tier);
		// Prefer tier-aware prompts; fallback to legacy randoms if needed
		const prompts = Array.from({ length: 5 }, () => getGenerationPrompt(tier)) || selectRandomTargets(5);
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
				const label = cleanGoldPrompt(prompt);
				return { goldToken: sealGoldPrompt(label), imageDataUrl, label, tier };
			}),
		);

		return NextResponse.json({ targets, tier }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}

// Build a simple centered 2D SVG shape for a seed like "red circle"
function buildShapeSvg(seed: string): string {
	const [rawColor, rawShape] = String(seed || '').toLowerCase().split(/\s+/);
	const color = mapColor(rawColor);
	const shape = rawShape || 'circle';
	const size = 512;
	const center = size / 2;
	const shapeSize = Math.round(size * 0.28);
	const stroke = 'none';
	const bg = '#ffffff';
	let shapeEl = '';
	switch (shape) {
		case 'circle':
			shapeEl = `<circle cx="${center}" cy="${center}" r="${shapeSize}" fill="${color}" stroke="${stroke}" />`;
			break;
		case 'square':
			shapeEl = `<rect x="${center - shapeSize}" y="${center - shapeSize}" width="${shapeSize * 2}" height="${shapeSize * 2}" fill="${color}" stroke="${stroke}" />`;
			break;
		case 'triangle':
			const h = Math.round(Math.sqrt(3) * shapeSize);
			shapeEl = `<polygon points="${center},${center - Math.round(h * 0.66)} ${center - shapeSize},${center + Math.round(h * 0.34)} ${center + shapeSize},${center + Math.round(h * 0.34)}" fill="${color}" stroke="${stroke}" />`;
			break;
		case 'star':
			shapeEl = buildStar(center, center, shapeSize, Math.round(shapeSize * 0.45), 5, color);
			break;
		case 'diamond':
			shapeEl = `<polygon points="${center},${center - shapeSize} ${center + shapeSize},${center} ${center},${center + shapeSize} ${center - shapeSize},${center}" fill="${color}" stroke="${stroke}" />`;
			break;
		case 'oval':
			shapeEl = `<ellipse cx="${center}" cy="${center}" rx="${Math.round(shapeSize * 1.3)}" ry="${shapeSize}" fill="${color}" stroke="${stroke}" />`;
			break;
		case 'hexagon':
			const r = shapeSize;
			const points = Array.from({ length: 6 }, (_, i) => {
				const a = (Math.PI / 3) * i;
				const x = center + r * Math.cos(a);
				const y = center + r * Math.sin(a);
				return `${Math.round(x)},${Math.round(y)}`;
			}).join(' ');
			shapeEl = `<polygon points="${points}" fill="${color}" stroke="${stroke}" />`;
			break;
		default:
			shapeEl = `<circle cx="${center}" cy="${center}" r="${shapeSize}" fill="${color}" stroke="${stroke}" />`;
	}
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bg}"/>
  ${shapeEl}
</svg>`;
}

function mapColor(name?: string): string {
	switch (name) {
		case 'red': return '#e11d48';
		case 'blue': return '#2563eb';
		case 'green': return '#16a34a';
		case 'yellow': return '#eab308';
		case 'orange': return '#f97316';
		case 'pink': return '#ec4899';
		case 'black': return '#111827';
		case 'cyan': return '#06b6d4';
		default: return '#6b7280';
	}
}

function buildStar(cx: number, cy: number, outer: number, inner: number, points: number, fill: string): string {
	let d = '';
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = (Math.PI / points) * i - Math.PI / 2;
		const x = cx + r * Math.cos(a);
		const y = cy + r * Math.sin(a);
		d += `${i === 0 ? 'M' : 'L'} ${Math.round(x)} ${Math.round(y)} `;
	}
	d += 'Z';
	return `<path d="${d}" fill="${fill}" />`;
}


