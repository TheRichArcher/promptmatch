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
		return `simple 2D ${shape} icon on white background`;
	}
	if (tier === 'medium') {
		const objects = [
			'yellow rubber duck',
			'red apple',
			'blue plastic cup',
			'green glass bottle',
			'silver metal sphere',
		];
		const textures = ['shiny', 'matte', 'fuzzy', 'smooth', 'rough'];
		const lighting = ['soft shadows', 'backlit', 'glowing edges', 'warm light', 'cool light'];
		const obj = objects[Math.floor(Math.random() * objects.length)];
		const tex = textures[Math.floor(Math.random() * textures.length)];
		const light = lighting[Math.floor(Math.random() * lighting.length)];
		return `${obj}, ${tex} surface, ${light}, plain white background, centered, no reflections, no environment`;
	}
	const easy = [
		'green triangle on white background',
		'red circle on gray floor',
		'blue square on plain wall',
		'yellow star on white surface',
	];
	const medium = [
		'yellow rubber duck, fuzzy texture, soft shadows, plain white background, centered, no reflections, no environment',
		'red apple, shiny surface, cool light, plain white background, centered, no reflections, no environment',
		'blue plastic cup, matte surface, warm light, plain white background, centered, no reflections, no environment',
		'green glass bottle, smooth surface, backlit, plain white background, centered, no reflections, no environment',
		'silver metal sphere, glossy shiny surface, glowing edges, plain white background, centered, no reflections, no environment',
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


