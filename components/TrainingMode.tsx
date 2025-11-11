'use client';

import { useMemo, useState } from 'react';
import CanvasPreview from '@/components/CanvasPreview';
import PromptInput from '@/components/PromptInput';
import { useTraining } from '@/hooks/useTraining';
import { trainingLevels } from '@/lib/levels';

export default function TrainingMode() {
	const { state, internal, handleNextRound, resetNewSet, retrySameSet } = useTraining(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const roundTitle = useMemo(() => {
		switch (state.round) {
			case 1:
				return 'Baseline';
			case 2:
				return 'Guided Revision';
			case 3:
				return 'Peer Example';
			case 4:
				return 'Reinforcement';
			default:
				return 'Summary';
		}
	}, [state.round]);

	const lastFeedback = state.feedback[state.feedback.length - 1] || '';
	const examplePrompt = internal.levels[Math.max(0, Math.min(internal.levels.length - 1, state.round - 1))]?.examplePrompt ?? '';

	// Preload prompt for Round 2
	const defaultPrompt =
		state.round === 2 ? state.prompts[0] ?? '' : state.round === 3 ? examplePrompt || state.prompts[1] || '' : state.round === 4 ? state.prompts[2] || '' : '';

	if (state.isComplete || state.round > 5) {
		const improvement = state.scores.length >= 2 ? Math.round((state.scores[state.scores.length - 1] ?? 0) - (state.scores[0] ?? 0)) : 0;
		const avgSimilarity =
			internal.similarities.length > 0 ? (internal.similarities.reduce((a, b) => a + b, 0) / internal.similarities.length).toFixed(2) : '—';
		const topTip = internal.feedback?.[0] || state.feedback[0] || 'Describe placement and composition.';
		return (
			<div className="card p-6 text-center">
				<div className="mb-2 text-2xl">🎓 Training Complete!</div>
				<div className="mb-4 text-gray-700">
					Round 1 → Round 5 Improvement: <span className="font-semibold">+{improvement} points</span>
					<br />
					Average Similarity: <span className="font-semibold">{avgSimilarity}</span>
					<br />
					Top Feedback: <span className="font-semibold">“{topTip}”</span>
				</div>
				<div className="flex justify-center gap-3">
					<button className="btn" onClick={retrySameSet}>
						Retry Set
					</button>
					<button className="btn bg-gray-900 hover:bg-black text-white" onClick={resetNewSet}>
						New Set
					</button>
				</div>
			</div>
		);
	}

	const handleSubmit = async (prompt: string) => {
		setIsSubmitting(true);
		try {
			await handleNextRound(prompt);
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentIdx = Math.max(0, Math.min(internal.levels.length - 1, state.round - 1));
	const level = internal.levels[currentIdx] ?? trainingLevels[0];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<div className="text-sm text-gray-500">🏁 Round {state.round} of 5</div>
					<h2 className="text-xl font-semibold">{roundTitle}</h2>
				</div>
				<a className="text-sm text-primary-600 hover:underline" href="/play">
					Single Round
				</a>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<div className="card p-4">
					<h3 className="mb-3 text-lg font-semibold">Target Image</h3>
					<CanvasPreview spec={level.spec as any} label="Target" />
				</div>
				<div className="card p-4">
					<h3 className="mb-3 text-lg font-semibold">Your Prompt</h3>
					{state.round === 3 && examplePrompt ? (
						<div className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
							Gold-standard example: <span className="font-semibold">“{examplePrompt}”</span>
						</div>
					) : null}
					{lastFeedback && state.round > 1 ? (
						<div className="mb-3 rounded-md bg-indigo-50 p-3 text-sm text-indigo-800">
							<span className="font-semibold">Feedback from last round:</span> “{lastFeedback}”
						</div>
					) : null}
					<PromptInput onSubmit={handleSubmit} isGenerating={isSubmitting} defaultPrompt={defaultPrompt} />
				</div>
			</div>
		</div>
	);
}


