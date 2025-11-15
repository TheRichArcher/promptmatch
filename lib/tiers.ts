export type Tier = 'easy' | 'medium' | 'hard' | 'advanced' | 'expert';

export const CURRICULUM = [
	{
		id: 'easy',
		name: 'Level 1 — Naming Things',
		skill: 'Clarity',
		goal: '95+',
		lesson: 'Tell Nano Banana what you see — like texting a friend.',
		bad: 'robot',
		good: 'small yellow cube robot',
	},
	{
		id: 'medium',
		name: 'Level 2 — Light & Texture',
		skill: 'Realism',
		goal: '90+',
		lesson: 'Lighting = mood. Texture = touch.',
		bad: 'robot',
		good: 'shiny metal robot with soft shadows',
	},
	{
		id: 'hard',
		name: 'Level 3 — Environment',
		skill: 'Scene Building',
		goal: '85+',
		lesson: 'No floating objects. Build the stage.',
		bad: 'robot',
		good: 'robot on workbench in lab',
	},
	{
		id: 'advanced',
		name: 'Level 4 — Style & Camera',
		skill: 'Art Direction',
		goal: '80+',
		lesson: 'You’re the director. Nano Banana is the camera.',
		bad: 'robot in lab',
		good: '50mm close-up, digital painting style',
	},
	{
		id: 'expert',
		name: 'Level 5 — Precision & Control',
		skill: 'Prompt Engineering',
		goal: '75+',
		lesson: 'Engineers don’t write — they compile.',
		bad: 'cool robot',
		good: 'Primary: yellow cube-robot... Negative: no scratches',
	},
];

export function getTierFromScore(score: number): Tier {
	if (score < 70) return 'easy';
	if (score < 85) return 'medium';
	if (score < 92) return 'hard';
	if (score < 97) return 'advanced';
	return 'expert';
}

export function getNextTier(current: Tier): Tier {
	const order: Tier[] = ['easy', 'medium', 'hard', 'advanced', 'expert'];
	const idx = order.indexOf(current);
	return order[Math.min(idx + 1, order.length - 1)];
}

export function getTierLabel(tier: Tier): string {
	switch (tier) {
		case 'easy':
			return 'Easy';
		case 'medium':
			return 'Medium';
		case 'hard':
			return 'Hard';
		case 'advanced':
			return 'Advanced';
		case 'expert':
			return 'Expert';
	}
}

export function tierToPath(tier: Tier): { group: 'training' | 'challenge'; leaf: string } {
	switch (tier) {
		case 'easy':
		case 'medium':
		case 'hard':
			return { group: 'training', leaf: tier };
		case 'advanced':
			return { group: 'challenge', leaf: 'advanced' };
		case 'expert':
			return { group: 'challenge', leaf: 'expert' };
	}
}


