export function getGenerationPrompt(tier: string): string {
	if (tier === 'easy') {
		const shapes = [
			'red circle',
			'blue square',
			'green triangle',
			'yellow star',
			'orange diamond',
			'pink oval',
			'black hexagon',
			// Removed cyan per requirement
			// 'cyan rectangle',
		];
		const shape = shapes[Math.floor(Math.random() * shapes.length)];
		return `flat 2D ${shape} centered on plain white background, vector style, no shadows, no texture, no lighting, clean edges, minimal design`;
	}
	const easy = [
		'green triangle on white background',
		'red circle on gray floor',
		'blue square on plain wall',
		'yellow star on white surface',
	];
	const medium = [
		'yellow rubber duck on white sink',
		'red apple on wooden table',
		'silver laptop on desk with window light',
	];
	const hard = [
		'red car on busy city street at sunset',
		'coffee cup next to open book on wooden desk',
	];
	const advanced = [
		'mountain lake with perfect reflection at golden hour',
		'cyberpunk alley with neon signs and rain',
	];
	const expert = [
		'cinematic shot of lone astronaut on alien planet with two moons',
		'steampunk library with floating books and dramatic lighting',
	];
	const pool =
		({
			easy,
			medium,
			hard,
			advanced,
			expert,
		} as Record<string, string[]>)[tier] || easy;
	return pool[Math.floor(Math.random() * pool.length)];
}


