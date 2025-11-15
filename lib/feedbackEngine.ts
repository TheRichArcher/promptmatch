import type { Tier } from '@/lib/tiers';

export type TargetMetadata = { label: string; url?: string; tier?: Tier };

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
			note: `Try: "${label}"`,
			tip: 'Use 2–3 words: color + shape',
		};
		try {
			// eslint-disable-next-line no-console
			console.log('FEEDBACK OUTPUT:', result.note);
		} catch {}
		return result;
	}
	if (tier === 'medium') {
		const result = {
			note: `Try: "${label} with lighting"`,
			tip: 'Add texture and light',
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


