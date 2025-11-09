export function generatePromptFeedback({
	prompt,
	targetDescription,
	similarity01,
}: {
	prompt: string;
	targetDescription: string;
	similarity01: number;
}) {
	const tips: string[] = [];
	const p = prompt.toLowerCase();
	const t = targetDescription.toLowerCase();

	// Color
	if (!/\b(red|green|blue|yellow|orange|purple|white|black|gray)\b/.test(p) && /\b(red|green|blue|yellow|orange|purple|white|black|gray)\b/.test(t)) {
		tips.push('Mention the color explicitly.');
	}
	// Size
	if (!/\b(small|medium|large|tiny|huge)\b/.test(p) && /\b(small|medium|large|tiny|huge)\b/.test(t)) {
		tips.push('Describe the size (e.g., small, medium, large).');
	}
	// Placement
	if (!/\b(center|centered|middle)\b/.test(p) && /\b(center|centered|middle)\b/.test(t)) {
		tips.push('Specify the placement (e.g., centered).');
	}
	// Background
	if (!/\bbackground\b/.test(p) && /\bbackground\b/.test(t)) {
		tips.push('Mention the background color or texture.');
	}

	// General coaching
	if (tips.length < 2) {
		tips.push('Add details on composition, lighting, or perspective for a small bonus.');
	}

	const note =
		similarity01 > 0.85
			? 'Excellent match! You captured most details.'
			: similarity01 > 0.6
			? 'Strong color match! Dial in size and placement for a higher score.'
			: 'You’ve got the idea. Add more specifics about size, color, and placement.';

	return { tips, note };
}


