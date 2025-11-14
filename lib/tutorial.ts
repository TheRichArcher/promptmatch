export const TUTORIAL_IMAGE_SRC = '/tutorial/red-ball.jpg';

export type FakeScoreResult = {
	score: number;
	goldPrompt: string;
	message: string;
};

export function evaluateTutorialPrompt(userPrompt: string): FakeScoreResult {
	const normalized = userPrompt.trim().toLowerCase();
	const hasRed = normalized.includes('red');
	const hasBall = normalized.includes('ball');
	const score = hasRed && hasBall ? 95 : 70;
	return {
		score,
		goldPrompt: 'red ball on white table',
		message:
			score >= 95
				? 'Perfect! You described the core details.'
				: 'Nice start — add color and object for a higher score.',
	};
}


