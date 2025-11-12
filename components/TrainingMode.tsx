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
		if (training.round === 2 && training.prompts.length >= 1) {
			setPrompt(training.prompts[0] || '');
		} else if (training.round !== 2) {
			setPrompt('');
		}
	}, [training.round, training.prompts]);

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
			const generatedImage: string | null = genJson?.image ?? genJson?.imageDataUrl ?? null;

			// Score using both images and gold prompt
			const scoreRes = await fetch('/api/score', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					targetDescription: currentTarget.prompt,
					targetImage: currentTarget.imageDataUrl,
					generatedImage,
				}),
			});
			const scoreJson = await scoreRes.json();
			const aiScore: number = scoreJson?.aiScore ?? 0;
			const note: string = scoreJson?.feedback?.note ?? '';

			setTraining((prev) => {
				const nextRound = prev.round + 1;
				const isComplete = nextRound > 5;
				return {
					...prev,
					prompts: [...prev.prompts, prompt],
					scores: [...prev.scores, aiScore],
					feedback: [...prev.feedback, note],
					round: nextRound,
					isComplete,
				};
			});
			setPrompt('');
		} finally {
			setLoading(false);
		}
	};

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

					{/* Round 2: Preload last prompt */}
					{training.round === 2 ? (
						<p className="text-sm text-green-600 mb-2">Edit your Round 1 prompt using the feedback</p>
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
						placeholder="Describe what you see..."
						className="w-full p-3 border rounded-lg"
						rows={4}
					/>
					<button onClick={handleSubmit} disabled={!prompt || loading} className="btn mt-3 w-full">
						{loading ? 'Scoring...' : 'Generate & Score'}
					</button>
				</div>
			</div>
		</div>
	);
}



