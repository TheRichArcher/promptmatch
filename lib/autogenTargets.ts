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
		return `${obj}, ${tex} surface, ${light}, simple studio background with soft gradient, no scene objects`;
	}
	const easy = [
		'green triangle on white background',
		'red circle on gray floor',
		'blue square on plain wall',
		'yellow star on white surface',
	];
	const medium = [
		'yellow rubber duck, fuzzy texture, soft shadows, simple studio background with soft gradient, no scene objects',
		'red apple, shiny surface, cool light, simple studio background with soft gradient, no scene objects',
		'blue plastic cup, matte surface, warm light, simple studio background with soft gradient, no scene objects',
		'green glass bottle, smooth surface, backlit, simple studio background with soft gradient, no scene objects',
		'silver metal sphere, glossy shiny surface, glowing edges, simple studio background with soft gradient, no scene objects',
	];
	const hard = [
		'busy downtown new york streets at midnight with wet pavement reflections, neon signs, light rain, cinematic',
		'vintage books stacked on a wooden desk in a professor’s office with warm light coming in from a window, glasses and coffee cup nearby',
		'steaming bowl of ramen with chopsticks on a wooden counter in a small tokyo shop, steam rising, soft neon reflections',
		'lighthouse at sunset with waves crashing against dark rocks, dramatic sky, warm orange glow',
		'chrome robot watering flowers in a lush garden at golden hour, small bird perched on hand',
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


