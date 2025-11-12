export function generateFeedback(
	target: string,
	prompt: string,
	score: number,
): { note: string; tip: string } {
	if (score > 90) {
		return { note: 'Mastered!', tip: 'Try Expert Mode' };
	}

	const missing: string[] = [];
	const targetLower = String(target || '').toLowerCase();
	const promptLower = String(prompt || '').toLowerCase();

	// Key attributes checks (simple heuristics)
	if (!promptLower.includes('large') && targetLower.includes('big')) {
		missing.push('size');
	}
	if (!promptLower.includes('center') && !promptLower.includes('middle')) {
		missing.push('placement');
	}
	if (!promptLower.includes('wood') && targetLower.includes('wood')) {
		missing.push('material');
	}
	if (!promptLower.includes('sunlight') && !promptLower.includes('shadow')) {
		missing.push('lighting');
	}

	const note =
		missing.length > 0
			? `Try: "${prompt} with ${missing.join(' and ')}"`
			: 'Almost perfect — add more detail like "shiny" or "reflection"';

	const tip = `Focus on: ${missing.length ? missing.join(', ') : 'style, mood, angle'}`;

	return { note, tip };
}


