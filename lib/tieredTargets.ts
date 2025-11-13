import path from 'node:path';
import fs from 'node:fs';
import type { Tier } from '@/lib/tiers';
import { tierToPath } from '@/lib/tiers';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tracks used absolute file paths to avoid repeats across sessions (per server instance)
const usedImages = new Set<string>();

export function clearUsedImages() {
	usedImages.clear();
}

function listImageFiles(absDir: string): string[] {
	if (!fs.existsSync(absDir)) return [];
	const entries = fs.readdirSync(absDir, { withFileTypes: true });
	return entries
		.filter(
			(e) =>
				e.isFile() &&
				['.png', '.jpg', '.jpeg'].includes(path.extname(e.name).toLowerCase()),
		)
		.map((e) => path.join(absDir, e.name));
}

export function getPoolForTier(projectRoot: string, tier: Tier): { absPaths: string[]; publicUrls: string[] } {
	const { group, leaf } = tierToPath(tier);
	const absDir = path.join(projectRoot, 'public', 'targets', group, leaf);
	const absPaths = listImageFiles(absDir);
	const publicUrls = absPaths.map((abs) => {
		const rel = abs.split(path.join(projectRoot, 'public'))[1];
		return rel.replace(/\\/g, '/'); // normalize for Windows
	});
	return { absPaths, publicUrls };
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function extractImageFromParts(parts: any[]): { dataUrl: string | null; mime?: string | null } {
	if (!Array.isArray(parts)) return { dataUrl: null, mime: null };
	for (const p of parts as any[]) {
		const inline = (p?.inlineData || p?.inline_data) as any;
		const data: string | undefined = inline?.data;
		const mime: string | undefined = inline?.mimeType || inline?.mime_type;
		if (data && (mime?.startsWith('image/') ?? false)) {
			return { dataUrl: `data:${mime};base64,${data}`, mime };
		}
	}
	return { dataUrl: null, mime: null };
}

export async function autoPopulateTierImages(projectRoot: string, tier: Tier): Promise<number> {
	const apiKey = process.env.GOOGLE_API_KEY;
	if (!apiKey) {
		console.warn('[autogen] Missing GOOGLE_API_KEY; cannot generate tier images');
		return 0;
	}

	const promptsByTier: Record<Tier, string[]> = {
		easy: ['red circle on white background', 'blue square', 'green triangle', 'yellow star icon', 'purple heart icon'],
		medium: ['apple on table', 'cup of coffee on desk', 'toy car on floor', 'slice of pizza on plate', 'yellow rubber duck'],
		hard: ['city street at night', 'bowl of ramen with chopsticks', 'stack of books on desk', 'lighthouse at sunset', 'robot in a garden'],
		advanced: ['person under umbrella in rain', 'cat painting a picture', 'crowd at concert', 'skateboard on sunny beach boardwalk', 'vintage car at dusk'],
		expert: ['surreal landscape with melting clocks', 'dragon made of clouds', 'robot holding flower', 'neon jellyfish in deep ocean', 'steampunk clock tower at midnight'],
	};

	const { group, leaf } = tierToPath(tier);
	const absDir = path.join(projectRoot, 'public', 'targets', group, leaf);
	ensureDir(absDir);

	const prompts = promptsByTier[tier] ?? [];
	if (prompts.length === 0) return 0;

	const genAI = new GoogleGenerativeAI(apiKey);
	const candidateModels = ['gemini-2.5-flash-image', 'gemini-2.5-flash'];

	let generated = 0;

	for (const prompt of prompts) {
		// Skip if already exists (by slug)
		const slug = slugify(prompt);
		const maybeExisting = ['.png', '.jpg', '.jpeg']
			.map((ext) => path.join(absDir, `${slug}${ext}`))
			.find((p) => fs.existsSync(p));
		if (maybeExisting) continue;

		let dataUrl: string | null = null;
		let lastError: unknown = null;
		for (const modelId of candidateModels) {
			try {
				const model = genAI.getGenerativeModel({ model: modelId as any });
				const result = await model.generateContent({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
				} as any);
				const response = (result as any).response ?? (await (result as any).response);
				const candidates = (response?.candidates ?? []) as any[];
				for (const c of candidates) {
					const parts = c?.content?.parts ?? [];
					const { dataUrl: maybe } = extractImageFromParts(parts);
					if (maybe) {
						dataUrl = maybe;
						break;
					}
				}
				if (!dataUrl) {
					const topLevelParts = (response?.parts ?? []) as any[];
					const { dataUrl: maybe } = extractImageFromParts(topLevelParts);
					dataUrl = maybe;
				}
				if (dataUrl) break;
				lastError = new Error('No image data returned by model response');
			} catch (e) {
				lastError = e;
				continue;
			}
		}

		if (!dataUrl) {
			console.warn('[autogen] failed to generate image for prompt:', prompt, lastError instanceof Error ? lastError.message : lastError);
			continue;
		}

		// Persist file
		const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
		if (!match) {
			console.warn('[autogen] Unexpected data URL format for prompt:', prompt);
			continue;
		}
		const mime = match[1].toLowerCase();
		const base64 = match[2];
		const ext = mime.includes('png') ? '.png' : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : '.png';
		const filePath = path.join(absDir, `${slug}${ext}`);
		try {
			const buf = Buffer.from(base64, 'base64');
			fs.writeFileSync(filePath, buf);
			generated += 1;
		} catch (e) {
			console.error('[autogen] failed to write file', filePath, e);
		}
	}

	if (generated > 0) {
		console.log(`[autogen] generated ${generated} images for tier ${tier}`);
	}
	return generated;
}

export async function pickUniqueImages(projectRoot: string, tier: Tier, count: number): Promise<{ abs: string; url: string; label: string }[]> {
	let { absPaths, publicUrls } = getPoolForTier(projectRoot, tier);
	if (absPaths.length === 0) {
		await autoPopulateTierImages(projectRoot, tier);
		({ absPaths, publicUrls } = getPoolForTier(projectRoot, tier));
		if (absPaths.length === 0) return [];
	}
	const pairs = absPaths.map((abs, i) => ({ abs, url: publicUrls[i] }));
	const available = pairs.filter((p) => !usedImages.has(p.abs));
	const source = available.length > 0 ? available : pairs;
	if (available.length === 0) {
		// reset if we've exhausted the pool
		usedImages.clear();
	}
	// Shuffle and take 'count'
	const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, Math.min(count, source.length));
	shuffled.forEach((p) => usedImages.add(p.abs));
	return shuffled.map(({ abs, url }) => {
		const base = path.basename(abs, path.extname(abs));
		const label = base.replace(/[-_]+/g, ' ').trim();
		return { abs, url, label };
	});
}

export function fileToDataUrl(absPath: string): string {
	const buf = fs.readFileSync(absPath);
	const b64 = buf.toString('base64');
	return `data:image/png;base64,${b64}`;
}

// Attempt to pick images for a tier, but if the pool is empty, fall back to lower tiers (hard → medium)
export async function pickUniqueImagesWithFallback(
	projectRoot: string,
	requestedTier: Tier,
	count: number,
): Promise<{ picks: { abs: string; url: string; label: string }[]; usedTier: Tier }> {
	// First try the requested tier (including autogen)
	let picks = await pickUniqueImages(projectRoot, requestedTier, count);
	if (picks.length > 0) {
		return { picks, usedTier: requestedTier };
	}
	// Only fall back for challenge tiers
	const fallbackOrder: Tier[] =
		requestedTier === 'expert' || requestedTier === 'advanced' ? ['hard', 'medium'] : [];
	for (const tier of fallbackOrder) {
		// Only use tiers that actually have a pool
		const { absPaths } = getPoolForTier(projectRoot, tier);
		if (absPaths.length === 0) continue;
		picks = await pickUniqueImages(projectRoot, tier, count);
		if (picks.length > 0) {
			return { picks, usedTier: tier };
		}
	}
	// Nothing available anywhere
	return { picks: [], usedTier: requestedTier };
}


