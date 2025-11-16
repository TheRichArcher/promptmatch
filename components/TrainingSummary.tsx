'use client';

import { useEffect, useMemo, useState } from 'react';
import Confetti from 'react-confetti';
import { mostFrequent } from '@/lib/trainingUtils';
import { saveProgress } from '@/lib/progress';
import { useRouter } from 'next/navigation';
import { getNextTier, getTierLabel, type Tier } from '@/lib/tiers';
import LoadingOverlay from './LoadingOverlay';

type Props = {
	scores: number[];
	feedback: string[];
	onNewSet: () => void;
	onNextTier: () => Promise<void>;
	userPrompts: string[];
	targets: { imageDataUrl: string; goldToken: string }[];
	generatedImages: (string | null)[];
	lastSuggestion?: string;
	lastTip?: string;
	currentTier: Tier;
};

export default function TrainingSummary({ scores, feedback, onNewSet, onNextTier, userPrompts, targets, generatedImages, lastSuggestion, lastTip, currentTier }: Props) {
	const [showConfetti, setShowConfetti] = useState(true);
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [isLoadingNext, setIsLoadingNext] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState<string>('Loading next level…');
	const [showToast, setShowToast] = useState(false);
	const [goldPrompts, setGoldPrompts] = useState<(string | null)[]>([]);
	const [goldAllowed, setGoldAllowed] = useState(false);
	const improvement = useMemo(() => {
		if (!scores || scores.length < 2) return 0;
		const first = scores[0] ?? 0;
		const last = scores[scores.length - 1] ?? first;
		return last - first;
	}, [scores]);
	const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
	const topFeedback = mostFrequent(feedback.filter(Boolean));
	const router = useRouter();

	const standardDeviation = useMemo(() => {
		if (!scores.length) return 0;
		const mean = averageScore;
		const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
		return Math.sqrt(variance);
	}, [scores, averageScore]);

	const consistency = useMemo(() => {
		return averageScore - (standardDeviation || 0);
	}, [averageScore, standardDeviation]);

	const nextTier = getNextTier(currentTier);
	const tierLabel = getTierLabel(currentTier);
	const nextTierLabel = getTierLabel(nextTier);
	const BRIEFING_MAP: Record<Tier, 'basics' | 'details' | 'scenes' | 'style' | 'precision'> = {
		easy: 'basics',
		medium: 'details',
		hard: 'scenes',
		advanced: 'style',
		expert: 'precision',
	};

	useEffect(() => {
		const timer = setTimeout(() => setShowConfetti(false), 5000);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		saveProgress({
			date: new Date().toISOString(),
			averageScore,
			improvement,
			rounds: scores.length,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Fetch Gold Prompts only after completion
	useEffect(() => {
		const tokens = targets.map((t) => t.goldToken);
		if (tokens.length === 0) return;
		(async () => {
			try {
				const res = await fetch('/api/train/summary', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tokens }),
				});
				const data = await res.json();
				if (res.ok && !data?.error) {
					setGoldAllowed(Boolean(data?.allowed));
					setGoldPrompts(Array.isArray(data?.goldPrompts) ? data.goldPrompts : []);
				}
			} catch {
				// ignore
			}
		})();
	}, [targets]);

	async function handleNextTier() {
		if (isAdvancing || isLoadingNext) return;
		setIsAdvancing(true);
		setIsLoadingNext(true);
		setLoadingMessage('Loading next level…');
		// Ensure overlay is visible before heavy work begins
		await new Promise((r) => setTimeout(r, 600));
		// Fallback nudger after 60s if still loading
		const fallbackTimer = setTimeout(() => {
			if (isLoadingNext) {
				setLoadingMessage('Still working… hang tight!');
			}
		}, 60000);
		try {
			await onNextTier();
			setShowToast(true);
			setTimeout(() => setShowToast(false), 2000);
		} finally {
			clearTimeout(fallbackTimer);
			setIsAdvancing(false);
			setIsLoadingNext(false);
		}
	}

	return (
		<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-2xl animate-fadeIn">
			<LoadingOverlay isLoading={isLoadingNext} message={loadingMessage} className="animate-fadeIn" />
			{isLoadingNext ? <Confetti recycle={false} /> : null}
			{showToast ? (
				<div className="fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded-lg shadow-lg animate-fadeIn">
					{nextTierLabel} unlocked!
				</div>
			) : null}
			{showConfetti && !isLoadingNext ? (
				<Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} />
			) : null}

			<div className="relative z-10 text-center space-y-6">
				<h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
					Level Complete! – {tierLabel}
				</h2>

				<div className="flex justify-center items-center gap-8 text-2xl font-semibold">
					<div>
						<span className="text-green-600">+{improvement}</span>
						<p className="text-sm text-gray-600">Point Improvement</p>
					</div>
					<div className="w-px h-12 bg-gray-300" />
					<div>
						<span className="text-indigo-600">{averageScore.toFixed(1)}</span>
						<p className="text-sm text-gray-600">Average Score</p>
					</div>
				</div>

				<div className="text-center p-3 bg-white/70 rounded-xl inline-block shadow">
					<p className="text-sm">Consistency Score: <strong>{consistency.toFixed(1)}</strong></p>
				</div>

				{lastSuggestion || lastTip ? (
					<div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
						<p className="font-medium">Suggestion:</p>
						{lastSuggestion ? <p className="text-sm">“{lastSuggestion}”</p> : null}
						{lastTip ? <p className="text-xs text-blue-600 mt-1">Tip: {lastTip}</p> : null}
					</div>
				) : null}

				<div className="grid grid-cols-5 gap-3 mt-2">
					{targets.map((t, i) => (
						<div key={i} className="text-center">
							<div className="flex flex-col gap-1">
								<img src={t.imageDataUrl} className="w-full h-24 object-cover rounded" />
								{generatedImages?.[i] ? (
									<img src={generatedImages[i] as string} className="w-full h-24 object-cover rounded" />
								) : (
									<div className="w-full h-24 rounded bg-gray-100 text-gray-400 text-[10px] flex items-center justify-center">
										No image
									</div>
								)}
							</div>
							<p className="text-xs font-bold mt-1">{scores[i] ?? '-'}</p>
							<p className="text-xs text-gray-600">{feedback[i] ?? ''}</p>
							{/* Learning moment - user prompt + gold prompt */}
							<div className="mt-1 text-[10px] text-gray-700">
								{scores[i] >= 90 ? (
									<p className="font-medium">Matched Gold Prompt</p>
								) : (
									<p><span className="font-medium">Your prompt:</span> {userPrompts?.[i] ?? ''}</p>
								)}
							</div>
							{goldAllowed && goldPrompts?.[i] ? (
								<div className="mt-1 text-[10px] text-gray-700">
									<span className="inline-block mr-1" aria-hidden="true">💡</span>
									<span className="sr-only">Learning moment: </span>
									<span className="font-medium">Ideal prompt: </span>
									<span>{goldPrompts[i]}</span>
								</div>
							) : null}
						</div>
					))}
				</div>

				{topFeedback ? (
					<div className="mx-auto max-w-md">
						<p className="text-sm italic text-gray-700 bg-white/70 rounded-xl p-4 shadow">“{topFeedback}”</p>
					</div>
				) : null}

				<div className="flex justify-center gap-4 mt-8">
					<button
						onClick={onNewSet}
						className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:scale-105 transition transform shadow-lg"
					>
						New Training Set
						<span className="block text-xs opacity-90">Practice {tierLabel} again</span>
					</button>
					<button
						onClick={handleNextTier}
						disabled={isAdvancing}
						aria-disabled={isAdvancing}
						aria-busy={isAdvancing}
						className="bg-white text-gray-800 px-8 py-3 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition shadow relative disabled:opacity-75 w-56"
					>
						{isAdvancing ? (
							<>
								<span className="inline-block h-4 w-4 align-[-2px] rounded-full border-2 border-gray-400 border-t-transparent animate-spin mr-2" aria-hidden="true" />
								<span role="status" aria-live="polite">Loading next level…</span>
							</>
						) : (
							<>
								Next Level – {nextTierLabel}
							</>
						)}
					</button>
				</div>

				<p className="text-sm text-gray-500 mt-6">Next up: <strong className="text-indigo-600">{nextTierLabel}</strong> – ready to level up?</p>
				<p className="text-center text-sm text-gray-500 mt-2">
					<a href="/progress" className="underline">View full progress →</a>
				</p>
			</div>
		</div>
	);
}


