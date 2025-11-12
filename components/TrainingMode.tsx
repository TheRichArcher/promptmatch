'use client';

import { useEffect, useState } from 'react';
import TrainingSummary from '@/components/TrainingSummary';

type Target = { prompt: string; imageDataUrl: string };
type TrainingState = {
	round: number;
	prompts: string[];
	scores: number[];
	feedback: string[];
	targets: Target[];
	isComplete: boolean;
};

export default function TrainingMode() {
	const [training, setTraining] = useState<TrainingState>({
		round: 1,
		prompts: [],
		scores: [],
		feedback: [],
		targets: [],
		isComplete: false,
	});
	const [prompt, setPrompt] = useState('');
	const [loading, setLoading] = useState(true);
	const [lastSubmittedRound, setLastSubmittedRound] = useState<number | null>(null);
	const [lastScore, setLastScore] = useState<number | null>(null);
	const [lastNote, setLastNote] = useState<string>('');
	const [generatedImage, setGeneratedImage] = useState<string | null>(null);

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
		const init = async () => {
			try {
				const res = await fetch('/api/train/init', { method: 'POST' });
				const { targets } = await res.json();
				setTraining((prev) => ({ ...prev, targets: targets ?? [] }));
			} finally {
				setLoading(false);
			}
		};
		void init();
	}, []);

	// Prefill prompt on Round 2
	useEffect(() => {
		// Clear the input whenever the round changes
		setPrompt('');
	}, [training.round]);

	const currentTarget = training.targets[training.round - 1];
	const lastFeedback = training.feedback[training.feedback.length - 1] || '';

	const handleSubmit = async () => {
		if (!currentTarget || !prompt || loading) return;
		setLoading(true);
		try {
			// Generate user image from prompt
			const genRes = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt }),
			});
			const genJson = await genRes.json();
			if (!genRes.ok || genJson?.error) {
				throw new Error(genJson?.error || 'Failed to generate image');
			}
			const genImageRaw: string | null = genJson?.image ?? genJson?.imageDataUrl ?? null;
			const genImage = genImageRaw ? await downscaleImage(genImageRaw, 1024, 0.85) : null;
			setGeneratedImage(genImage ?? null);

			// Score using both images and gold prompt
			const targetDown = await downscaleImage(currentTarget.imageDataUrl, 1024, 0.85);
			const scoreRes = await fetch('/api/score', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					targetDescription: currentTarget.prompt,
					targetImage: targetDown,
					generatedImage: genImage,
				}),
			});
			const scoreJson = await scoreRes.json();
			const aiScore: number = scoreJson?.aiScore ?? 0;
			const note: string = scoreJson?.feedback?.note ?? '';

			// Store results but do not advance round yet; show score and Next button
			setTraining((prev) => ({
				...prev,
				prompts: [...prev.prompts, prompt],
				scores: [...prev.scores, aiScore],
				feedback: [...prev.feedback, note],
			}));
			setLastSubmittedRound(training.round);
			setLastScore(aiScore);
			setLastNote(note);
			setPrompt('');
		} finally {
			setLoading(false);
		}
	};

	const goNextRound = () => {
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
				isComplete: nextRound > 5,
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

	if (loading && training.round === 1) {
		return <p className="text-center">Generating training images...</p>;
	}

	if (training.isComplete) {
		return (
			<TrainingSummary
				scores={training.scores}
				feedback={training.feedback}
				targets={training.targets}
				onNewSet={() => window.location.reload()}
				onNextTier={() => (window.location.href = '/train')}
			/>
		);
	}

	return (
		<div className="max-w-5xl mx-auto">
			<div className="text-center mb-6">
				<h2 className="text-2xl font-bold">Round {training.round} of 5</h2>
			</div>

			{/* Images Row with Prompt/Result on the right */}
			<div className="grid md:grid-cols-2 gap-8">
				<div>
					<h3 className="font-semibold mb-2">Target Image</h3>
					{currentTarget ? <img src={currentTarget.imageDataUrl} alt="Target" className="w-full rounded-lg shadow-lg" /> : null}
				</div>
				<div>
					<h3 className="font-semibold mb-2">Your Image</h3>
					{/* When not yet generated, let user type directly in this panel */}
					{!generatedImage && !isRoundScored ? (
						<div className="w-full">
							{/* Guidance and tips inline */}
							{training.round === 2 ? <p className="text-sm text-green-600 mb-2">Use your Round 1 learnings to improve.</p> : null}
							{training.round === 3 && currentTarget ? (
								<details className="mb-3 p-3 bg-amber-50 rounded border">
									<summary className="font-medium cursor-pointer">Gold Prompt (90+ Score)</summary>
									<code className="block mt-2 text-xs text-gray-700">{currentTarget.prompt}</code>
								</details>
							) : null}
							{lastFeedback && training.round > 1 ? (
								<p className="text-sm italic text-gray-600 mb-2">Feedback: {lastFeedback}</p>
							) : null}
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
								disabled={loading || !prompt}
								className="btn mt-3 w-full"
							>
								{loading ? 'Scoring...' : 'Generate & Score'}
							</button>
						</div>
					) : (
						<>
							{generatedImage ? (
								<img src={generatedImage} alt="Your generated" className="w-full rounded-lg shadow-lg" />
							) : null}
							<button
								onClick={goNextRound}
								disabled={loading}
								className="btn mt-3 w-full"
							>
								{training.round === 5 ? 'View Results' : 'Next Round'}
							</button>
							{isRoundScored ? (
								<div className="mt-4 rounded border p-4">
									<div className="text-lg font-semibold">Score: {lastScore ?? 0}</div>
									{lastNote ? <div className="mt-1 text-sm text-gray-700">{lastNote}</div> : null}
								</div>
							) : null}
						</>
					)}
				</div>
			</div>
		</div>
	);
}



