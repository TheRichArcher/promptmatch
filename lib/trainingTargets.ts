export const TARGET_PROMPTS = [
	// Beginner
	'A red balloon floating in a blue sky',
	'A slice of pizza on a marble table',
	'A cartoon cat wearing sunglasses',
	'A blue mug on a white table',
	'A yellow rubber duck in a bathtub',

	// Intermediate
	'A lighthouse at sunset on a rocky coast',
	'A robot watering plants in a garden',
	'A skateboard on a sunny beach boardwalk',
	'A panda eating noodles at a bamboo table',

	// Advanced
	'A vintage car parked in the golden desert at dusk',
	'A cosmic portal made of swirling light in space',
	'A neon jellyfish floating in deep ocean',
	'A steampunk clock tower at midnight',
	'A dragon curled around a glowing crystal',
];

export function selectRandomTargets(count = 5): string[] {
	const shuffled = [...TARGET_PROMPTS].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}


