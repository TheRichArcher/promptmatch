import type { Tier } from '@/lib/tiers';

export type TargetMetadata = { label: string; url?: string; tier?: Tier; goldPrompt?: string };

export function generateFeedback(prompt: string, target: TargetMetadata): { note: string; tip: string } {
	const label = String(target?.label || '').trim();
	const tier: Tier | undefined = target?.tier;
	if (!label) {
		throw new Error('Target label missing');
	}
	// TEMP DEBUG LOGS (remove after fix)
	try {
		// eslint-disable-next-line no-console
		console.log('FEEDBACK TARGET:', label);
	} catch {}
	// Medium-tier: produce a short, humanized suggestion emphasizing object + texture + light
	const humanizeMedium = (full: string): string => {
		let s = String(full || '').trim();
		if (!s) return s;
		// Split on commas; drop background/position/environment/style qualifiers
		const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
		const kept = parts.filter((p) => {
			const lower = p.toLowerCase();
			if (/\b(background|center|centred|centered|reflection|reflections|environment|style)\b/.test(lower)) return false;
			if (/^no\s+/.test(lower)) return false;
			return true;
		});
		// Keep up to object, texture/surface, and light
		let candidate = kept.slice(0, 3).join(', ');
		// Prefer "surface" over "texture" wording for natural tone
		candidate = candidate.replace(/\btexture\b/gi, 'surface');
		// Enforce <10 words; if too long, drop to first two segments or trim to 9 words
		const words = candidate.split(/\s+/).filter(Boolean);
		if (words.length >= 10) {
			const two = kept.slice(0, 2).join(', ').replace(/\btexture\b/gi, 'surface');
			const twoWords = two.split(/\s+/).filter(Boolean);
			if (two && twoWords.length < 10) return two;
			return words.slice(0, 9).join(' ');
		}
		return candidate;
	};
	if (tier === 'easy') {
		const result = {
			note: 'Great! Keep naming simple shapes with colors.',
			tip: 'Tip: Keep it short — 2–3 words is enough.',
		};
		try {
			// eslint-disable-next-line no-console
			console.log('FEEDBACK OUTPUT:', result.note);
		} catch {}
		return result;
	}
	if (tier === 'medium') {
		const gold = String(target?.goldPrompt || label).trim();
		const note = humanizeMedium(gold || label);
		const result = {
			note,
			tip: 'Add texture (shiny, fuzzy) + light (soft, glowing)',
		};
		try {
			// eslint-disable-next-line no-console
			console.log('FEEDBACK OUTPUT:', result.note);
		} catch {}
		return result;
	}
	// Default: still target-aware, no generic curriculum substitution
	const result = {
		note: `Try: "${String(target?.goldPrompt || label).trim()}"`,
		tip: 'Be specific about color, texture, and lighting',
	};
	try {
		// eslint-disable-next-line no-console
		console.log('FEEDBACK OUTPUT:', result.note);
	} catch {}
	return result;
}


