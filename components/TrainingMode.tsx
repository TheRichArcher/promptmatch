'use client';

import { useEffect, useState } from 'react';

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
			const genImage: string | null = genJson?.image ?? genJson?.imageDataUrl ?? null;
			setGeneratedImage(genImage);

			// Score using both images and gold prompt
			const scoreRes = await fetch('/api/score', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					targetDescription: currentTarget.prompt,
					targetImage: currentTarget.imageDataUrl,
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
		const first = training.scores[0] ?? 0;
		const last = training.scores[training.scores.length - 1] ?? first;
		const improvement = last - first;
		const avg =
			training.scores.length > 0
				? (training.scores.reduce((a, b) => a + b, 0) / training.scores.length).toFixed(1)
				: '0.0';
		return (
			<div className="text-center p-8 bg-green-50 rounded-xl">
				<h2 className="text-3xl font-bold mb-4">Training Complete!</h2>
				<p className="text-2xl">+{improvement} point improvement</p>
				<p className="text-xl">Average Score: {avg}</p>
				<button onClick={() => window.location.reload()} className="btn mt-6">
					New Training Set
				</button>
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto">
			<div className="text-center mb-6">
				<h2 className="text-2xl font-bold">Round {training.round} of 5</h2>
			</div>

			<div className="grid md:grid-cols-2 gap-8">
				{/* Target */}
				<div>
					<h3 className="font-semibold mb-2">Target Image</h3>
					{currentTarget ? (
						<img src={currentTarget.imageDataUrl} alt="Target" className="w-full rounded-lg shadow-lg" />
					) : null}
				</div>

				{/* Input */}
				<div>
					<h3 className="font-semibold mb-2">Your Prompt</h3>

					{/* Round guidance */}
					{training.round === 2 ? (
						<p className="text-sm text-green-600 mb-2">Use your Round 1 learnings to improve.</p>
					) : null}

					{/* Round 3: Show gold prompt */}
					{training.round === 3 && currentTarget ? (
						<details className="mb-4 p-3 bg-amber-50 rounded border">
							<summary className="font-medium cursor-pointer">Gold Prompt (90+ Score)</summary>
							<code className="block mt-2 text-xs text-gray-700">{currentTarget.prompt}</code>
						</details>
					) : null}

					{/* Feedback from last round */}
					{lastFeedback && training.round > 1 ? (
						<p className="text-sm italic text-gray-600 mb-3">Feedback: {lastFeedback}</p>
					) : null}

					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Describe what you see..."
						className="w-full p-3 border rounded-lg"
						rows={4}
					/>
					<button
						onClick={isRoundScored ? goNextRound : handleSubmit}
						disabled={loading || (!isRoundScored && !prompt)}
						className="btn mt-3 w-full"
					>
						{loading ? 'Scoring...' : isRoundScored ? 'Next Round' : 'Generate & Score'}
					</button>
					{generatedImage ? (
						<div className="mt-4">
							<div className="mb-2 text-sm font-semibold text-gray-700">Your Image</div>
							<img src={generatedImage} alt="Your generated" className="w-full rounded-lg shadow" />
						</div>
					) : null}
					{isRoundScored ? (
						<div className="mt-4 rounded border p-4">
							<div className="text-lg font-semibold">Score: {lastScore ?? 0}</div>
							{lastNote ? <div className="mt-1 text-sm text-gray-700">{lastNote}</div> : null}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}



