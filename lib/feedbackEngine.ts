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
		const result = {
			note: `Try: "${target?.goldPrompt || label}"`,
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
		note: `Try: "${label}"`,
		tip: 'Be specific about color, texture, and lighting',
	};
	try {
		// eslint-disable-next-line no-console
		console.log('FEEDBACK OUTPUT:', result.note);
	} catch {}
	return result;
}


