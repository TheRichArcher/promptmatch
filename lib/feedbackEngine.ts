export function generateFeedback(
	target: string,
	prompt: string,
	score: number,
): { note: string; tip: string } {
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

	// High score: give specific finishing touches instead of generic praise
	if (score > 90) {
		const t = String(target || '').toLowerCase();
		const missing: string[] = [];
		if (t.includes('fog') || t.includes('smoke')) missing.push('fog/smoke');
		if (t.includes('rain') || t.includes('wet')) missing.push('weather');
		if (t.includes('reflection') || t.includes('glass')) missing.push('reflections');
		return {
			note: missing.length ? `Try adding: ${missing.join(', ')} for 95+` : 'Perfect! Ready for Expert Mode',
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
		// Pick the first two non-stopword tokens as a cheap "subject" proxy.
		const tokens = extractKeywords(text);
		return tokens.slice(0, 2).join(' ') || 'target';
	}

	const targetKeywords = extractKeywords(targetLower);
	const promptKeywords = extractKeywords(promptLower);

	// What appears in the target description but not the user's prompt?
	const missingKeywords = Array.from(new Set(targetKeywords.filter((w) => !promptKeywords.includes(w)))).slice(0, 8);

	// Classify missing attributes for a clearer tip
	const missingAttributes: string[] = [];
	for (const [attr, words] of Object.entries(ATTR_HINTS)) {
		if (words.some((w) => targetLower.includes(w)) && !words.some((w) => promptLower.includes(w))) {
			missingAttributes.push(attr);
		}
	}

	const subject = extractSubject(targetLower);
	const attributesPart = missingKeywords.filter((w) => !subject.includes(w)).slice(0, 5).join(', ');

	// Note is anchored to the TARGET, not the user's incorrect subject.
	const note =
		missingKeywords.length > 0
			? `Try: "${subject}${attributesPart ? ' with ' + attributesPart : ''}"`
			: `Describe the ${subject} with specific color, lighting and placement.`;

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


