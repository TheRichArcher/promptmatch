'use client';

import { useEffect, useRef, useState } from 'react';
import TrainingSummary from '@/components/TrainingSummary';
import ProgressHeader from '@/components/ProgressHeader';
import { getNextTier, getTierFromScore, getTierLabel, CURRICULUM, type Tier } from '@/lib/tiers';
import { saveRoundState, loadLevelState, saveLevelState, incrementLevel, type LevelState } from '@/lib/trainingUtils';
import LevelBriefingOverlay from '@/components/LevelBriefingOverlay';

type Target = { goldToken: string; imageDataUrl: string; label?: string; tier?: Tier };
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
	// Users may replay any previously unlocked tier.
	// Users may NOT advance to a tier they haven't unlocked.
	// Highest unlocked tier still loads by default.
	const TIER_ORDER: Tier[] = ['easy', 'medium', 'hard', 'advanced', 'expert'];
	const FORCE_TIER_KEY = 'forceTier';
	const [tier, setTier] = useState<Tier>(() => {
		const saved = loadLevelState(5);
		const unlockedIdx = Math.min(Math.max(1, Number(saved.current) || 1), TIER_ORDER.length) - 1;
		const highestUnlocked = TIER_ORDER[unlockedIdx];
		let forced: Tier | null = null;
		if (typeof window !== 'undefined') {
			try {
				const raw = window.localStorage.getItem(FORCE_TIER_KEY);
				if (raw && (TIER_ORDER as string[]).includes(raw)) {
					forced = raw as Tier;
				}
			} catch {}
		}
		if (forced) {
			const forcedIdx = TIER_ORDER.indexOf(forced);
			// Ignore attempts to force a tier beyond what is unlocked
			if (forcedIdx <= unlockedIdx) {
				return forced;
			}
		}
		return highestUnlocked;
	});
	const [errorMsg, setErrorMsg] = useState<string>('');
	const [tierNotice, setTierNotice] = useState<string>('');
	const [isLevelLoading, setIsLevelLoading] = useState<boolean>(false);
	const [isAdvancingRound, setIsAdvancingRound] = useState<boolean>(false);
	const [showLevelToast, setShowLevelToast] = useState<boolean>(false);
	const [isFreePlay, setIsFreePlay] = useState<boolean>(false);
	// Level briefing overlay state
	const [showBriefing, setShowBriefing] = useState<boolean>(false);
	const [briefingLevel, setBriefingLevel] = useState<string | null>(null);
	const initializingRef = useRef(initializing);
	useEffect(() => {
		initializingRef.current = initializing;
	}, [initializing]);
	const prevTierRef = useRef<Tier>(null as any);
	const initialMountRef = useRef<boolean>(true);
	// Map internal tiers to briefing keys
	const BRIEFING_MAP: Record<Tier, 'basics' | 'details' | 'scenes' | 'style' | 'precision'> = {
		easy: 'basics',
		medium: 'details',
		hard: 'scenes',
		advanced: 'style',
		expert: 'precision',
	};
	// Show briefing overlay on tier change (skip very first load)
	useEffect(() => {
		if (initialMountRef.current) {
			initialMountRef.current = false;
			prevTierRef.current = tier;
			return;
		}
		if (prevTierRef.current !== tier) {
			prevTierRef.current = tier;
			setBriefingLevel(BRIEFING_MAP[tier]);
			setShowBriefing(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tier]);
	// Auto-close briefing when images finish loading
	useEffect(() => {
		if (!initializing && showBriefing) {
			setShowBriefing(false);
		}
	}, [initializing, showBriefing]);

	function getUnlockedRank(): number {
		// levelState.current is 1-based; map to 0-based index into TIER_ORDER
		return Math.min(TIER_ORDER.length - 1, Math.max(0, (levelState?.current || 1) - 1));
	}
	function requestTierChange(requested: Tier) {
		const requestedRank = TIER_ORDER.indexOf(requested);
		const unlockedRank = getUnlockedRank();
		if (requestedRank > unlockedRank) {
			// Prevent skipping ahead
			setErrorMsg('Tier not unlocked yet');
			return;
		}
		try {
			window.localStorage.setItem(FORCE_TIER_KEY, requested);
		} catch {}
		// Switching tier resets state via loadSet effect below
		setIsFreePlay(false);
		setErrorMsg('');
		setTier(requested);
	}

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
			const genResp = await postJson('/api/generate', { prompt, tier }, 1);
			if (!genResp.ok) throw new Error(genResp.json?.error || 'Failed to generate image');
			const genJson = genResp.json;
			const genImageRaw: string | null = genJson?.image ?? genJson?.imageDataUrl ?? null;
			const genImage = genImageRaw ? await downscaleImage(genImageRaw, 1024, 0.85) : null;
			setGeneratedImage(genImage ?? null);

			// Score using both images and gold prompt
			const targetDown = await downscaleImage(currentTarget.imageDataUrl, 1024, 0.85);
			const scoreResp = await postJson('/api/score', {
					prompt,
					target: {
						label: currentTarget?.label ?? '',
						url: currentTarget.imageDataUrl,
						tier,
					},
					targetToken: currentTarget.goldToken,
					targetImage: targetDown,
					generatedImage: genImage,
					tier,
					targetMeta: {
						label: currentTarget?.label ?? '',
						tier: currentTarget?.tier ?? tier,
						goldPrompt: undefined,
					},
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
		// During initialization of a new level, prefer the Level Briefing overlay if active.
		if (showBriefing && briefingLevel) {
			return <LevelBriefingOverlay level={briefingLevel} />;
		}
		return (
			<div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-sm">
				<div className="flex flex-col items-center">
					<div className="h-12 w-12 rounded-full border-2 border-primary-600 border-t-transparent animate-spin mb-4" />
					<p className="text-base text-gray-800 font-medium">Loading your next level…</p>
					<p className="text-sm text-gray-600 mt-1">Generating images (this can take ~30 seconds).</p>
				</div>
			</div>
		);
	}

	if (training.isComplete) {
		return (
			<>
				{showBriefing && briefingLevel ? <LevelBriefingOverlay level={briefingLevel} /> : null}
				<TrainingSummary
					scores={training.scores}
					feedback={training.feedback}
					userPrompts={training.prompts}
					targets={training.targets}
					generatedImages={training.generatedImages}
					lastSuggestion={lastNote}
					lastTip={lastTip}
					currentTier={tier}
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
							// Advance strictly based on the current tier order, not the score-derived tier.
							const next = getNextTier(tier);
							// Free Play Mode after Precision
							if (tier === 'expert') {
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
			{showBriefing && briefingLevel ? <LevelBriefingOverlay level={briefingLevel} /> : null}
			{showLevelToast ? (
				(() => {
					const unlockedIdx = Math.max(0, TIER_ORDER.findIndex((t) => t === tier));
					const unlockedLevel = CURRICULUM.find((l) => l.id === tier);
					const levelNumber = unlockedIdx + 1;
					return (
						<div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-xl shadow-lg animate-slideUp w-[min(92vw,28rem)]">
							<h3 className="font-bold text-lg">🔓 {unlockedLevel?.name || `Level ${levelNumber}`} Unlocked!</h3>
							<p className="text-sm">Now learn: <strong>{unlockedLevel?.skill || 'New Skill'}</strong></p>
							<img
								src={`/curriculum/level-${levelNumber}.jpg`}
								alt="example"
								className="mt-2 rounded"
								onError={(e) => {
									const el = e.currentTarget as HTMLImageElement;
									if (!el.dataset.fallback) {
										el.dataset.fallback = '1';
										el.src = '/curriculum/placeholder.svg';
									}
								}}
							/>
							<p className="text-xs mt-2">Aim for <strong>{unlockedLevel?.goal || '—'}</strong> consistency</p>
						</div>
					);
				})()
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
					{tierNotice}
				</div>
			) : null}
			<div className="mb-6 animate-fadeIn">
				<ProgressHeader tier={tier} round={training.round} roundsTotal={training.roundsTotal} isFreePlay={isFreePlay} />
				{/* Choose Level control (only unlocked tiers are enabled) */}
				<div className="mt-3 flex items-center gap-3">
					<label className="text-sm font-medium text-gray-700">Choose Level</label>
					<select
						className="text-sm border rounded-md px-2 py-1 bg-white"
						value={tier}
						onChange={(e) => requestTierChange(e.target.value as Tier)}
					>
						{TIER_ORDER.map((t) => {
							const rank = TIER_ORDER.indexOf(t);
							const disabled = rank > getUnlockedRank();
							return (
								<option key={t} value={t} disabled={disabled}>
									{getTierLabel(t)}
								</option>
							);
						})}
					</select>
					<span className="text-xs text-gray-500">(Locked levels are disabled)</span>
				</div>
				{/* Level introduction and examples */}
				{(() => {
					const currentLevel = CURRICULUM.find((l) => l.id === tier);
					return currentLevel ? (
						<div className="text-center mb-4">
							<h2 className="text-xl font-bold text-purple-700">{currentLevel.name}</h2>
							<p className="text-sm text-gray-600">Now learn: <strong>{currentLevel.skill}</strong></p>
						</div>
					) : null;
				})()}
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



