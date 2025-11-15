import { generateFeedback } from '../lib/feedbackEngine';

describe('feedback engine', () => {
	test('feedback matches current target', () => {
		const targets = [
			{ label: 'glowing heart', tier: 'easy' as const },
			{ label: 'yellow flower crown', tier: 'medium' as const },
		];
		for (const t of targets) {
			const feedback = generateFeedback('test', t);
			expect(feedback.note).toContain(t.label);
		}
	});
});


