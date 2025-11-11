'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Level } from '@/lib/levels';
import { describeSpec, mutateSpecSimilar, selectRandomTargets, shapeSpecToDataUrl } from '@/lib/targets';

export type TrainingState = {
	round: number; // 1–5
	prompts: string[]; // User inputs per round
	scores: number[]; // AI scores per round
	feedback: string[]; // Short notes returned from /api/score
	targetImages: string[]; // Base64 for the rounds
	isComplete: boolean;
};

type InternalState = TrainingState & {
	levels: Level[];
	similarities: number[]; // 0..1
};

const STORAGE_KEY = 'promptmatch_training_state';

async function scoreRound(prompt: string, targetDescription: string, targetImage?: string) {
	const res = await fetch('/api/score', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			prompt,
			targetDescription,
			targetImage: targetImage ?? null,
			generatedImage: null,
		}),
	});
	const data = await res.json();
	if (!res.ok || data?.error) {
		throw new Error(data?.error || 'Failed to score');
	}
	return {
		score: Number(data.aiScore ?? 0),
		feedback: (data.feedback?.note as string) || '',
		similarity01: typeof data.similarity01 === 'number' ? data.similarity01 : null,
	};
}

export function useTraining(initialSameSet?: { levels: Level[]; images: string[] } | null) {
	const initial = useMemo<InternalState>(() => {
		// Attempt to restore from localStorage
		if (typeof window !== 'undefined') {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw) as InternalState;
					return parsed;
				}
			} catch {}
		}

		// Fresh selection (or provided sameSet)
		let levels: Level[] = [];
		let images: string[] = [];
		if (initialSameSet) {
			levels = initialSameSet.levels;
			images = initialSameSet.images;
		} else {
			const picked = selectRandomTargets(5);
			levels = picked.map((p) => p.level);
			images = picked.map((p) => p.imageDataUrl);
		}

		return {
			round: 1,
			prompts: [],
			scores: [],
			feedback: [],
			targetImages: images,
			isComplete: false,
			levels,
			similarities: [],
		};
	}, [initialSameSet]);

	const [state, setState] = useState<InternalState>(initial);

	// Persist
	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {}
	}, [state]);

	const resetNewSet = useCallback(() => {
		const picked = selectRandomTargets(5);
		setState({
			round: 1,
			prompts: [],
			scores: [],
			feedback: [],
			targetImages: picked.map((p) => p.imageDataUrl),
			isComplete: false,
			levels: picked.map((p) => p.level),
			similarities: [],
		});
	}, []);

	const retrySameSet = useCallback(() => {
		setState((prev) => ({
			round: 1,
			prompts: [],
			scores: [],
			feedback: [],
			targetImages: [...prev.targetImages],
			isComplete: false,
			levels: [...prev.levels],
			similarities: [],
		}));
	}, []);

	const handleNextRound = useCallback(
		async (prompt: string | null) => {
			if (state.isComplete) return;
			const current = state.round;

			// Round-specific behavior:
			// 1: Baseline (score)
			// 2: Guided (score) - prefill is handled by UI
			// 3: Peer Example (score still allowed; UI shows example)
			// 4: Reinforcement (similar image; score)
			// 5: Summary (no action)
			if (current >= 5) {
				setState((prev) => ({ ...prev, isComplete: true }));
				return;
			}

			const levelIdx = Math.max(0, Math.min(state.levels.length - 1, current - 1));
			const level = state.levels[levelIdx];

			let targetImageForScoring = state.targetImages[levelIdx] ?? null;
			let targetDescription = level.description;

			// Round 4: Use a similar-but-new image and description
			if (current === 4) {
				const similar = mutateSpecSimilar(level.spec as any);
				targetImageForScoring = shapeSpecToDataUrl(similar);
				targetDescription = describeSpec(similar);
			}

			if (!prompt || !prompt.trim()) {
				// Just advance without scoring if no prompt (defensive)
				setState((prev) => ({
					...prev,
					prompts: [...prev.prompts, ''],
					round: current + 1,
					isComplete: current + 1 > 5,
				}));
				return;
			}

			const { score, feedback, similarity01 } = await scoreRound(prompt.trim(), targetDescription, targetImageForScoring ?? undefined);

			setState((prev) => ({
				...prev,
				prompts: [...prev.prompts, prompt.trim()],
				scores: [...prev.scores, score],
				feedback: [...prev.feedback, feedback],
				similarities: [...prev.similarities, typeof similarity01 === 'number' ? similarity01 : 0],
				round: current + 1,
				isComplete: current + 1 > 5,
			}));
		},
		[state],
	);

	return {
		state: {
			round: state.round,
			prompts: state.prompts,
			scores: state.scores,
			feedback: state.feedback,
			targetImages: state.targetImages,
			isComplete: state.isComplete,
		} as TrainingState,
		internal: state,
		handleNextRound,
		resetNewSet,
		retrySameSet,
	};
}


