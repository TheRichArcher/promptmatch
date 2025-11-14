'use client';

import { useEffect, useRef, useState } from 'react';
import TrainingSummary from '@/components/TrainingSummary';
import ProgressHeader from '@/components/ProgressHeader';
import { getNextTier, getTierFromScore, type Tier } from '@/lib/tiers';
import { saveRoundState, loadLevelState, saveLevelState, incrementLevel, type LevelState } from '@/lib/trainingUtils';

type Target = { goldToken: string; imageDataUrl: string };
type TrainingState = {
	round: number;
	prompts: string[];
	scores: number[];
	feedback: string[];
	targets: Target[];
	generatedImages: (string | null)[];
	isComplete: boolean;
	roundsTotal: number;
};

export default function TrainingMode() {
	const [training, setTraining] = useState<TrainingState>({
		round: 1,
		prompts: [],
		scores: [],
		feedback: [],
		targets: [],
		generatedImages: [],
		isComplete: false,
		roundsTotal: 5,
	});
	// Gold prompts are sealed; do not reveal during rounds
	const [initializing, setInitializing] = useState(true);
	const [levelState, setLevelState] = useState<LevelState>(() => loadLevelState(5));
	const [prompt, setPrompt] = useState('');
	const [loading, setLoading] = useState(true);
	const [lastSubmittedRound, setLastSubmittedRound] = useState<number | null>(null);
	const [lastScore, setLastScore] = useState<number | null>(null);
	const [lastNote, setLastNote] = useState<string>('');
	const [lastTip, setLastTip] = useState<string>('');
	const [generatedImage, setGeneratedImage] = useState<string | null>(null);
	const [tier, setTier] = useState<Tier>(() => {
		const ORDER: Tier[] = ['easy', 'medium', 'hard', 'advanced', 'expert'];
		const saved = loadLevelState(5);
		const idx = Math.min(Math.max(1, Number(saved.current) || 1), ORDER.length) - 1;
		return ORDER[idx];
	});
	const [errorMsg, setErrorMsg] = useState<string>('');
	const [tierNotice, setTierNotice] = useState<string>('');
	const [isLevelLoading, setIsLevelLoading] = useState<boolean>(false);
	const [isAdvancingRound, setIsAdvancingRound] = useState<boolean>(false);
	const [showLevelToast, setShowLevelToast] = useState<boolean>(false);
	const [isFreePlay, setIsFreePlay] = useState<boolean>(false);
	const initializingRef = useRef(initializing);
	useEffect(() => {
		initializingRef.current = initializing;
	}, [initializing]);

	// Downscale utility to keep images < ~1.5MB for scoring API
	function downscaleImage(dataUrl: string, maxDim = 1024, quality = 0.85): Promise<string> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let width = (img as HTMLImageElement).width;
				let height = (img as HTMLImageElement).height;
				if (width > height && width > maxDim) {
					height = Math.round((height * maxDim) / width);
					width = maxDim;
				} else if (height > maxDim) {
					width = Math.round((width * maxDim) / height);
					height = maxDim;
				}
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0, width, height);
				// Use JPEG with quality limiter; helps ensure under size cap
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.src = dataUrl;
		});
	}

	// Load session on mount
	useEffect(() => {
		void loadSet({ resetUsed: false, tier });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tier]);

	async function loadSet({ resetUsed, tier }: { resetUsed: boolean; tier: Tier }) {
		setInitializing(true);
		setLoading(true);
		try {
			const res = await fetch('/api/train/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tier, resetUsed }),
			});
			const { targets, notice } = await res.json();
			setTraining((prev) => ({
				...prev,
				round: 1,
				prompts: [],
				scores: [],
				feedback: [],
				targets: targets ?? [],
				generatedImages: [],
				isComplete: false,
				roundsTotal: Math.max(1, Array.isArray(targets) ? targets.length : 5),
			}));
			setTierNotice(typeof notice === 'string' ? notice : '');
			setLastSubmittedRound(null);
			setLastScore(null);
			setLastNote('');
			setPrompt('');
			setGeneratedImage(null);
		} finally {
			setLoading(false);
			setInitializing(false);
		}
	}

	function waitForInitialization(): Promise<void> {
		return new Promise((resolve) => {
			const check = () => {
				if (!initializingRef.current) {
					resolve();
				} else {
					setTimeout(check, 100);
				}
			};
			check();
		});
	}

	// Prefill prompt on Round 2
	useEffect(() => {
		// Clear the input whenever the round changes
		setPrompt('');
	}, [training.round]);

	// Persist minimal round state between renders (session-only)
	useEffect(() => {
		saveRoundState({ round: training.round, roundsTotal: training.roundsTotal });
	}, [training.round, training.roundsTotal]);

	// Persist level state when it changes
	useEffect(() => {
		saveLevelState(levelState);
	}, [levelState]);

	const currentTarget = training.targets[training.round - 1];

	async function postJson<T = any>(url: string, data: unknown, retries = 1): Promise<{ ok: boolean; json: any; status: number }> {
		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const res = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data),
				});
				const json = await res.json().catch(() => ({}));
				if (res.ok && !json?.error) return { ok: true, json, status: res.status };
				if (attempt < retries) {
					await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
					continue;
				}
				return { ok: false, json, status: res.status };
			} catch {
				if (attempt < retries) {
					await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
					continue;
				}
				return { ok: false, json: { error: 'Network error' }, status: 0 };
			}
		}
		return { ok: false, json: { error: 'Unknown error' }, status: 0 };
	}

	const handleSubmit = async () => {
		if (!currentTarget || !prompt || loading) return;
		setLoading(true);
		setErrorMsg('');
		try {
			// Generate user image from prompt
			const genResp = await postJson('/api/generate', { prompt }, 1);
			if (!genResp.ok) throw new Error(genResp.json?.error || 'Failed to generate image');
			const genJson = genResp.json;
			const genImageRaw: string | null = genJson?.image ?? genJson?.imageDataUrl ?? null;
			const genImage = genImageRaw ? await downscaleImage(genImageRaw, 1024, 0.85) : null;
			setGeneratedImage(genImage ?? null);

			// Score using both images and gold prompt
			const targetDown = await downscaleImage(currentTarget.imageDataUrl, 1024, 0.85);
			const scoreResp = await postJson('/api/score', {
					prompt,
					targetToken: currentTarget.goldToken,
					targetImage: targetDown,
					generatedImage: genImage,
				}, 1);
			if (!scoreResp.ok) throw new Error(scoreResp.json?.error || 'Failed to score image');
			const scoreJson = scoreResp.json;
			const aiScore: number = scoreJson?.aiScore ?? 0;
			const note: string = scoreJson?.feedback?.note ?? '';
			const tip: string = scoreJson?.feedback?.tip ?? '';

			// Store results but do not advance round yet; show score and Next button
			setTraining((prev) => ({
				...prev,
				prompts: [...prev.prompts, prompt],
				scores: [...prev.scores, aiScore],
				feedback: [...prev.feedback, note],
				generatedImages: [...prev.generatedImages, genImage ?? null],
			}));
			setLastSubmittedRound(training.round);
			setLastScore(aiScore);
			setLastNote(note);
			setLastTip(tip);
			setPrompt('');
		} catch (e: any) {
			setErrorMsg(e?.message || 'Something went wrong. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	const goNextRound = () => {
		// Safety: do not advance unless the current round has been scored
		if (lastSubmittedRound !== training.round) {
			return;
		}
		setIsAdvancingRound(true);
		setLastSubmittedRound(null);
		setLastScore(null);
		setLastNote('');
		setPrompt('');
		setGeneratedImage(null);
		setTraining((prev) => {
			const nextRound = prev.round + 1;
			return {
				...prev,
				round: nextRound,
				isComplete: nextRound > prev.roundsTotal,
			};
		});
	};

	const isRoundScored = lastSubmittedRound === training.round;

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (isRoundScored) {
				goNextRound();
			} else if (!loading && prompt.trim()) {
				void handleSubmit();
			}
		}
	}

	if (initializing && training.round === 1) {
		return <p className="text-center">Generating training images...</p>;
	}

	if (training.isComplete) {
		return (
			<>
				<TrainingSummary
					scores={training.scores}
					feedback={training.feedback}
					userPrompts={training.prompts}
					targets={training.targets}
					generatedImages={training.generatedImages}
					lastSuggestion={lastNote}
					lastTip={lastTip}
					onNewSet={async () => {
						if (isLevelLoading) return;
						setIsLevelLoading(true);
						try {
							await loadSet({ resetUsed: false, tier });
							await waitForInitialization();
						} finally {
							setIsLevelLoading(false);
						}
					}}
					onNextTier={async () => {
						if (isLevelLoading) return;
						setIsLevelLoading(true);
						try {
							const avg = training.scores.length ? training.scores.reduce((a, b) => a + b, 0) / training.scores.length : 0;
							const currentTier = getTierFromScore(avg);
							const next = getNextTier(currentTier);
							// Free Play Mode after Expert
							if (currentTier === 'expert') {
								console.info('🎮 Switching to Free Play Mode');
								setIsFreePlay(true);
							} else {
								setIsFreePlay(false);
							}
							setTier(next);
							await waitForInitialization();
							// Advance level progression and show toast
							const nextLevel = incrementLevel();
							setLevelState((prev) => ({ ...prev, current: nextLevel }));
							setShowLevelToast(true);
							setTimeout(() => setShowLevelToast(false), 2000);
						} finally {
							setIsLevelLoading(false);
						}
					}}
				/>
			</>
		);
	}

	return (
		<div className="max-w-5xl mx-auto relative">
			{showLevelToast ? (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-green-600 text-white px-4 py-2 rounded-lg shadow animate-fadeIn">
					Level {levelState.current} Unlocked!
				</div>
			) : null}
			{isAdvancingRound ? (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm animate-fadeIn">
					<div className="flex flex-col items-center">
						<div className="h-10 w-10 rounded-full border-2 border-primary-600 border-t-transparent animate-spin mb-3" />
						<p className="text-sm text-gray-700">Loading next round...</p>
					</div>
				</div>
			) : null}
			{tierNotice ? (
				<div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
					{tierNotice} Using a lower-tier pool for now.
				</div>
			) : null}
			<div className="mb-6 animate-fadeIn">
				<ProgressHeader tier={tier} round={training.round} roundsTotal={training.roundsTotal} isFreePlay={isFreePlay} />
				{isFreePlay ? (
					<div className="mt-2">
						<div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
							<span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
							Free Play Mode
						</div>
					</div>
				) : null}
			</div>

			{/* Images Row with Prompt/Result on the right */}
			<div className="grid md:grid-cols-2 gap-8">
				<div>
					<h3 className="font-semibold mb-2">Target Image</h3>
					{currentTarget ? (
						<img
							src={currentTarget.imageDataUrl}
							alt="Target"
							className="w-full rounded-lg shadow-lg"
							onLoad={() => setIsAdvancingRound(false)}
						/>
					) : null}
				</div>
				<div>
					<h3 className="font-semibold mb-2">Your Image</h3>
					{/* When not yet generated, let user type directly in this panel */}
					{!generatedImage && !isRoundScored ? (
						<div className="w-full">
							{/* Guidance and tips inline */}
							{training.round === 2 ? <p className="text-sm text-green-600 mb-2">Use your Round 1 learnings to improve.</p> : null}
							<textarea
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Describe what you see..."
								className="w-full p-3 border rounded-lg"
								rows={8}
							/>
							<button
								onClick={handleSubmit}
								disabled={loading || isAdvancingRound || !prompt || !currentTarget}
								className="btn mt-3 w-full"
							>
								{loading ? 'Scoring...' : 'Generate & Score'}
							</button>
							{errorMsg ? <p className="text-xs text-red-600 mt-2">{errorMsg}</p> : null}
						</div>
					) : (
						<>
							{generatedImage ? (
								<img src={generatedImage} alt="Your generated" className="w-full rounded-lg shadow-lg" />
							) : null}
							<button
								onClick={goNextRound}
								disabled={loading || isAdvancingRound}
								className="btn mt-3 w-full"
							>
								{training.round === training.roundsTotal ? 'View Results' : 'Next Round'}
							</button>
							{isRoundScored ? (
								<div className="mt-4 rounded border p-4">
									<div className="text-lg font-semibold">Score: {lastScore ?? 0}</div>
									{lastNote || lastTip ? (
										<div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
											<strong>Suggestion:</strong> {lastNote}
											{lastTip ? <p className="text-xs text-blue-600 mt-1">Tip: {lastTip}</p> : null}
										</div>
									) : null}
								</div>
							) : null}
						</>
					)}
				</div>
			</div>
		</div>
	);
}



