export type Tier = 'easy' | 'medium' | 'hard' | 'advanced' | 'expert';

export const CURRICULUM = [
	{ id: 'easy',     name: 'Basics',    skill: 'Name + Color + Shape',         goal: '95+' },
	{ id: 'medium',   name: 'Details',   skill: 'Lighting + Texture',            goal: '90+' },
	{ id: 'hard',     name: 'Scenes',    skill: 'Environment + Composition',     goal: '85+' },
	{ id: 'advanced', name: 'Style',     skill: 'Camera + Art Direction',        goal: '80+' },
	{ id: 'expert',   name: 'Precision', skill: 'Hierarchy + Control',           goal: '75+' },
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


