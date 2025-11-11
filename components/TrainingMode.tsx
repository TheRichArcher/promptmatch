'use client';

import { useEffect, useMemo, useState } from 'react';
import CanvasPreview from '@/components/CanvasPreview';
import PromptInput from '@/components/PromptInput';
import { useTraining } from '@/hooks/useTraining';
import { trainingLevels } from '@/lib/levels';

export default function TrainingMode() {
	const { state, internal, scoreCurrentRound, goNextRound, resetNewSet, retrySameSet } = useTraining(null);
	const [isScoring, setIsScoring] = useState(false);
	const [lastSubmittedRound, setLastSubmittedRound] = useState<number | null>(null);

	const { headerTitle, headerSub } = useMemo(() => {
		switch (state.round) {
			case 1:
				return { headerTitle: 'Round 1 – Baseline', headerSub: '“Describe what you see.”' };
			case 2:
				return { headerTitle: 'Round 2 – Guided Revision', headerSub: '“Try improving based on your last feedback.”' };
			case 3:
				return { headerTitle: 'Round 3 – Peer Example', headerSub: '“Compare to a model-perfect prompt.”' };
			case 4:
				return { headerTitle: 'Round 4 – Reinforcement', headerSub: '“Try again with a new target.”' };
			default:
				return { headerTitle: 'Round 5 – Results Summary', headerSub: '“View your improvement and feedback highlights.”' };
		}
	}, [state.round]);

	const lastFeedback = state.feedback[state.feedback.length - 1] || '';
	const examplePrompt = internal.levels[Math.max(0, Math.min(internal.levels.length - 1, state.round - 1))]?.examplePrompt ?? '';

	// Preload prompt for Round 2
	const defaultPrompt = useMemo(() => {
		if (state.round >= 2) {
			const prior = state.prompts[state.round - 2] ?? '';
			if (state.round === 3 && examplePrompt) {
				// Show example but still prefill prior
				return prior;
			}
			return prior;
		}
		return '';
	}, [state.prompts, state.round, examplePrompt]);

	// Progress calculations
	const progressPct = Math.min(100, Math.max(0, (state.round / 5) * 100));
	const blocks = new Array(5).fill(0).map((_, i) => i < state.round ? 'filled' : 'empty');

	if (state.isComplete || state.round > 5) {
		const improvement = state.scores.length >= 2 ? Math.round((state.scores[state.scores.length - 1] ?? 0) - (state.scores[0] ?? 0)) : 0;
		const avgSimilarity =
			internal.similarities.length > 0 ? (internal.similarities.reduce((a, b) => a + b, 0) / internal.similarities.length).toFixed(2) : '—';
		const topTip = state.feedback[0] || 'Describe placement and composition.';
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
		setIsScoring(true);
		try {
			await scoreCurrentRound(prompt);
			setLastSubmittedRound(state.round);
		} finally {
			setIsScoring(false);
		}
	};

	const currentIdx = Math.max(0, Math.min(internal.levels.length - 1, state.round - 1));
	const level = internal.levels[currentIdx] ?? trainingLevels[0];

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<div>
						<div className="text-sm text-gray-500">Training Mode — Round {state.round} of 5</div>
						<h2 className="text-xl font-semibold">{headerTitle}</h2>
						<div className="text-sm text-gray-600">{headerSub}</div>
					</div>
				</div>
				{/* Progress Bar */}
				<div className="w-full rounded-full bg-gray-100">
					<div
						className="h-2 rounded-full bg-indigo-500 transition-all"
						style={{ width: `${progressPct}%` }}
					/>
				</div>
				{/* Blocks */}
				<div className="flex gap-1">
					{blocks.map((type, idx) => (
						<div
							key={idx}
							className={`h-2 flex-1 rounded ${type === 'filled' ? 'bg-indigo-500' : 'bg-gray-200'}`}
						/>
					))}
				</div>
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
					{state.round > 1 && (lastFeedback || true) ? (
						<div className="mb-3 rounded-md bg-indigo-50 p-3 text-sm text-indigo-800">
							<span className="font-semibold">💡 Tip from last round:</span> “{lastFeedback || 'Add details about background or lighting.'}”
						</div>
					) : null}
					<PromptInput onSubmit={handleSubmit} isGenerating={isScoring} defaultPrompt={defaultPrompt} />
				</div>
			</div>

			{/* Feedback + Next Round CTA after scoring */}
			{lastSubmittedRound === state.round ? (
				<div className="grid gap-6 md:grid-cols-2">
					<div className="card p-4">
						<div className="text-lg">✨ Feedback</div>
						<div className="mt-2 text-sm text-gray-800">“{lastFeedback || 'You’ve got the idea — specify placement and size.'}”</div>
						<div className="mt-2 text-sm text-gray-600">Next up: Try refining your description to improve your score.</div>
					</div>
					<div className="card flex items-center justify-between gap-4 p-4">
						<div className="text-sm text-gray-600">Ready for the next round?</div>
						<button
							className="btn"
							onClick={() => {
								goNextRound();
								setLastSubmittedRound(null);
							}}
						>
							Next Round ➜
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}


