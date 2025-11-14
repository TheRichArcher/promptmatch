import type { Tier } from '@/lib/tiers';

type TargetMetadata = { label?: string; goldPrompt?: string; tier?: Tier };

export function generateFeedback(
	target: string | TargetMetadata,
	prompt: string,
	score: number,
	opts?: { tier?: Tier },
): { note: string; tip: string } {
	// Always show gold prompt for Easy tier
	if (typeof target === 'object' && target?.tier === 'easy') {
		const label = String(target.label || '').trim();
		const gold = String(target.goldPrompt || label || '').trim();
		return {
			note: gold ? `Try: "${gold}"` : 'Try: use color + shape',
			tip: 'Use 2–3 words: color + shape',
		};
	}
	// If metadata provided, prefer metadata-driven feedback as specified
	if (typeof target === 'object' && target) {
		if (score >= 90) {
			return { note: 'Mastered!', tip: 'Ready for next tier' };
		}
		const label = String(target.label || '').trim();
		const gold = String(target.goldPrompt || label || '').trim();
		const labelTip = label ? label.split(/\s+/).join(' + ') : 'color + shape';
		return {
			note: gold ? `Try: "${gold}"` : 'Try 2–3 words matching the subject',
			tip: `Use 2–3 words: ${labelTip}`,
		};
	}
	// Small pool of generic but varied prompting tips for when no specific attributes are detected
	const GENERIC_TIPS = [
		'Add a camera angle (macro, wide, overhead)',
		'Specify time of day and lighting (golden hour, overcast)',
		'Mention material and texture (wood, metal, glossy, matte)',
		'Add style cues (cinematic, vintage, studio photo)',
		'Control depth of field (shallow focus, bokeh)',
		'Refine background/foreground separation',
		'Boost contrast and shadows for clarity',
		'State color palette explicitly',
		'Describe placement and distance (centered, close‑up)',
		'Use environment context (on a table, on the beach)',
	];

	function pickDeterministic<T>(arr: T[], seedStr: string): T {
		let h = 0;
		for (let i = 0; i < seedStr.length; i++) {
			h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
		}
		const idx = h % arr.length;
		return arr[idx];
	}

	function sanitizePhrase(text: string): string {
		let t = String(text || '').trim();
		// Collapse duplicate prepositions (basic)
		t = t.replace(/\b(with|of|in|on|at|to)\s+\1\b/gi, '$1');
		// Strip "with" if followed by determiner+noun phrase
		t = t.replace(/\bwith\s+(a|an|the)\s+/gi, '$1 ');
		// Remove stray "with" if it appears before adjectives
		t = t.replace(/\bwith\s+/gi, '');
		// Lowercase leading article
		t = t.replace(/^(A|An|The)\b/, (m) => m.toLowerCase());
		// Remove trailing punctuation
		t = t.replace(/[.,;:!?]+$/g, '');
		// Collapse extra whitespace
		t = t.replace(/\s{2,}/g, ' ').trim();
		return t;
	}

	// Normalize/canonicalize labels or filenames into readable phrases
	function getReadableLabel(label: string, tier?: Tier): string {
		let s = String(label || '').replace(/[_-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
		// Remove generic non-informative tokens
		s = s.replace(/\b(shape|object|pattern|symbol|icon)\b/gi, ' ');
		// For non-easy tiers, aggressively drop geometric primitives
		if (tier && tier !== 'easy') {
			s = s.replace(
				/\b(circle|square|triangle|rectangle|star|heart|hexagon|octagon|polygon|line|dot)\b/gi,
				' ',
			);
		}
		// Collapse whitespace
		s = s.replace(/\s{2,}/g, ' ').trim();
		return s;
	}

	function removeShapeTerms(text: string): string {
		return String(text || '')
			.replace(
				/\b(circle|square|triangle|rectangle|star|heart|hexagon|octagon|polygon|line|dot|icon|symbol|shape)\b/gi,
				' ',
			)
			.replace(/\s{2,}/g, ' ')
			.trim();
	}

	// High score: give specific finishing touches instead of generic praise
	if (score > 90) {
		const t = String(target || '').toLowerCase();
		const missing: string[] = [];
		if (t.includes('fog') || t.includes('smoke')) missing.push('fog/smoke');
		if (t.includes('rain') || t.includes('wet')) missing.push('weather');
		if (t.includes('reflection') || t.includes('glass')) missing.push('reflections');
		return {
			note: missing.length ? `Try adding: ${missing.join(', ')} for 95+` : 'Perfect! You matched the Gold Prompt.',
			tip: 'Focus on: atmosphere, weather, reflections',
		};
	}

	const targetLower = String(target || '').toLowerCase();
	const promptLower = String(prompt || '').toLowerCase();

	// Lightweight keyword extraction focused on nouns/attributes.
	const STOPWORDS = new Set([
		'a','an','the','with','and','or','of','on','in','at','to','for','by','from','over','under','into','near','next','up','down','is','are','be',
		'very','some','more','most','much','many','few','less','least','this','that','these','those','it','its','as','like','while','between','behind','front',
	]);
	const ATTR_HINTS = {
		color: ['red','blue','green','yellow','orange','purple','pink','white','black','gray','brown','gold','silver'],
		material: ['wood','metal','glass','plastic','stone','marble','fabric','ceramic'],
		lighting: ['sunlight','shadow','shadows','soft light','hard light','studio','backlit','sunny','golden hour','overcast'],
		placement: ['center','centred','centered','middle','left','right','close-up','closeup','wide','overhead','top-down','background','foreground'],
		style: ['vintage','modern','minimal','realistic','photo','photograph','macro','film','bokeh','cinematic'],
	};

	function tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, ' ')
			.split(/\s+/)
			.filter(Boolean);
	}

	function extractKeywords(text: string): string[] {
		const tokens = tokenize(text);
		return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
	}

	function extractSubject(text: string): string {
		// Use cleaned label as the base, then pick the first two non-stopword tokens as a cheap "subject" proxy.
		const cleaned = getReadableLabel(text, opts?.tier);
		const tokens = extractKeywords(cleaned);
		return tokens.slice(0, 2).join(' ') || 'target';
	}

	// For non-easy tiers, down-weight geometric primitives in keyword set
	const effectiveTargetText = opts?.tier && opts.tier !== 'easy' ? removeShapeTerms(targetLower) : targetLower;
	const targetKeywords = extractKeywords(effectiveTargetText);
	const promptKeywords = extractKeywords(opts?.tier && opts.tier !== 'easy' ? removeShapeTerms(promptLower) : promptLower);

	// What appears in the target description but not the user's prompt?
	const missingKeywords = Array.from(new Set(targetKeywords.filter((w) => !promptKeywords.includes(w)))).slice(0, 8);

	// Classify missing attributes for a clearer tip
	const missingAttributes: string[] = [];
	for (const [attr, words] of Object.entries(ATTR_HINTS)) {
		if (words.some((w) => effectiveTargetText.includes(w)) && !words.some((w) => promptLower.includes(w))) {
			missingAttributes.push(attr);
		}
	}

	const subject = extractSubject(effectiveTargetText);
	const attributesPart = missingKeywords.filter((w) => !subject.includes(w)).slice(0, 5).join(', ');

	// Note is anchored to the TARGET, not the user's incorrect subject.
	let note: string;
	if (missingKeywords.length > 0) {
		const attributesNounPhrase = attributesPart
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.join(' ');
		let rawPhrase = `${attributesNounPhrase} ${subject}`.trim();
		// As a final pass, for non-easy tiers prefer scene nouns over shapes
		if (opts?.tier && opts.tier !== 'easy') {
			rawPhrase = removeShapeTerms(rawPhrase);
		}
		const cleaned = sanitizePhrase(rawPhrase);
		// Ensure we don't emit an empty suggestion
		note = cleaned ? `Try: "${cleaned}"` : `Describe the ${subject} with specific color, lighting and placement.`;
	} else {
		note = `Describe the ${subject} with specific color, lighting and placement.`;
	}

	const tip =
		missingAttributes.length > 0
			? `Focus on: ${missingAttributes.join(', ')}`
			: (() => {
					// If we have concrete missing keywords, surface a couple of them; otherwise pick a varied generic coaching tip
					const concrete = attributesPart
						.split(',')
						.map((s) => s.trim())
						.filter(Boolean);
					if (concrete.length > 0) {
						const few = concrete.slice(0, 2).join(', ');
						return `Add specifics: ${few}`;
					}
					return pickDeterministic(GENERIC_TIPS, targetLower + '|' + promptLower);
			  })();

	return { note, tip };
}


