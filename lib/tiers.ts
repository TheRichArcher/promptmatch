export type Tier = 'easy' | 'medium' | 'hard' | 'advanced' | 'expert';

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


