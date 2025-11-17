import type { Tier } from '@/lib/tiers';

export type TargetMetadata = { label: string; url?: string; tier?: Tier; goldPrompt?: string };

function generateDynamicTip(prompt: string, tier: Tier | undefined): string {
	const lower = String(prompt || '').toLowerCase().trim();
	if (!lower) {
		return tier === 'easy' ? 'Start with object + color (e.g., "red circle")' : 'Describe what you see in detail.';
	}

	// Detect elements in the prompt
	const hasColor = /\b(red|blue|green|yellow|orange|pink|black|white|purple|brown|gray|grey|cyan|magenta|silver|gold|bronze)\b/.test(lower);
	const hasTexture = /\b(shiny|matte|fuzzy|rough|smooth|glossy|textured|surface|gloss|dull|polished|weathered)\b/.test(lower);
	const hasLight = /\b(shadow|shadows|light|lighting|glowing|backlit|warm|cool|glow|bright|dim|soft|hard|dramatic|cinematic)\b/.test(lower);
	const hasScene = /\b(background|desk|table|floor|ground|room|kitchen|forest|garden|street|beach|ocean|sky|mountain|workshop|studio|office|shop|diner|restaurant|counter|shelf|surface|environment|setting|scene|location|place|dusk|dawn|sunset|sunrise|night|day|outdoor|indoor|outside|inside)\b/.test(lower) || /\b(on|in|at)\s+(a|the|an|this|that|one|the)\s+\w+/.test(lower);
	const hasArtisticDirection = /\b(lens|mm|f\/|aperture|camera|shot|photo|photograph|film|digital|painting|canvas|oil|watercolor|cinematic|aesthetic|style|vintage|modern|pixar|cyberpunk|polaroid|35mm|50mm|85mm|wide|angle|close-up|portrait|landscape)\b/.test(lower);
	const hasNegativePrompt = /--no\s+\w+/.test(lower);
	const hasAspectRatio = /--ar\s+[\d:]+/.test(lower);
	const hasQualityBoosters = /\b(masterpiece|best quality|ultra-detailed|highly detailed|8k|4k|hd|professional)\b/.test(lower);

	// Generate tier-specific dynamic tips
	if (tier === 'easy') {
		if (!hasColor) {
			return 'Add a color (red, blue, green, yellow, etc.)';
		}
		return 'Keep it short — 2–3 words is enough.';
	}

	if (tier === 'medium') {
		const missing: string[] = [];
		if (!hasTexture) missing.push('texture (shiny, matte, fuzzy)');
		if (!hasLight) missing.push('lighting (soft, warm, glowing)');
		if (missing.length > 0) {
			return `Add ${missing.join(' and ')}`;
		}
		return 'Great! You have object, color, texture, and light.';
	}

	if (tier === 'hard') {
		const missing: string[] = [];
		if (!hasTexture) missing.push('texture');
		if (!hasLight) missing.push('lighting');
		if (!hasScene) missing.push('a real scene/environment');
		if (missing.length > 0) {
			return `Add ${missing.join(', ')}`;
		}
		return 'Great! You have object, color, texture, light, and scene.';
	}

	if (tier === 'advanced') {
		const missing: string[] = [];
		if (!hasTexture) missing.push('texture');
		if (!hasLight) missing.push('lighting');
		if (!hasScene) missing.push('scene');
		if (!hasArtisticDirection) missing.push('artistic direction (lens, medium, aesthetic)');
		if (missing.length > 0) {
			return `Add ${missing.join(', ')}`;
		}
		return 'Great! You have all Level 4 elements.';
	}

	if (tier === 'expert') {
		const missing: string[] = [];
		if (!hasTexture) missing.push('texture');
		if (!hasLight) missing.push('lighting');
		if (!hasScene) missing.push('scene');
		if (!hasArtisticDirection) missing.push('artistic direction');
		if (!hasNegativePrompt) missing.push('negative prompts (--no blur, scratches)');
		if (!hasAspectRatio) missing.push('aspect ratio (--ar 16:9)');
		if (!hasQualityBoosters) missing.push('quality boosters (masterpiece, ultra-detailed)');
		if (missing.length > 0) {
			return `Add ${missing.slice(0, 3).join(', ')}`;
		}
		return 'Perfect! You have all precision elements.';
	}

	// Default fallback
	return 'Be specific about color, texture, and lighting';
}

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
			tip: generateDynamicTip(prompt, tier),
		};
		try {
			// eslint-disable-next-line no-console
			console.log('FEEDBACK OUTPUT:', result.note);
		} catch {}
		return result;
	}
	if (tier === 'medium') {
		const gold = String(target?.goldPrompt || label).trim();
		// Show the full, complete gold prompt to prevent regression to partial phrasing
		const result = {
			note: `Try: "${gold}"`,
			tip: generateDynamicTip(prompt, tier),
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
		tip: generateDynamicTip(prompt, tier),
	};
	try {
		// eslint-disable-next-line no-console
		console.log('FEEDBACK OUTPUT:', result.note);
	} catch {}
	return result;
}


