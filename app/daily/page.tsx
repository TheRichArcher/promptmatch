'use client';

import { useState, useEffect } from 'react';

export default function DailyChallenge() {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [prompt, setPrompt] = useState('');
	const [generatedImage, setGeneratedImage] = useState<string | null>(null);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/api/daily')
			.then((r) => r.json())
			.then(setData)
			.catch((err) => {
				console.error('Failed to load daily challenge:', err);
				setData({ error: 'Failed to load challenge' });
			})
			.finally(() => setLoading(false));
	}, []);

	const handleSubmit = async () => {
		if (!prompt.trim() || generating) return;

		setGenerating(true);
		setError(null);
		setGeneratedImage(null);

		try {
			const res = await fetch('/api/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ prompt: prompt.trim() }),
			});

			const result = await res.json();

			if (!res.ok) {
				throw new Error(result.error || 'Failed to generate image');
			}

			const imageUrl = result.imageDataUrl || result.image;
			if (!imageUrl) {
				throw new Error('No image returned');
			}

			setGeneratedImage(imageUrl);
		} catch (err: any) {
			setError(err?.message || 'Failed to generate image');
			console.error('Generation error:', err);
		} finally {
			setGenerating(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	};

	if (loading) return <div className="text-center p-8">Loading today's challenge...</div>;

	if (!data || data.error) return <div className="text-center p-8">Error loading challenge</div>;

	return (
		<div className="max-w-2xl mx-auto pt-10 px-6">
			<h1 className="text-4xl font-bold text-center mb-4">PromptMatch Daily</h1>
			<p className="text-center text-xl mb-8">One prompt. Best score wins.</p>
			<div className="bg-gray-900 rounded-xl p-8">
				<div className="text-center mb-4 text-white">Day {data.day}</div>
				<img src={data.targetImage} className="w-full rounded-lg" alt="Daily challenge target" />
				
				{generatedImage && (
					<div className="mt-6">
						<p className="text-white text-sm mb-2">Your generated image:</p>
						<img src={generatedImage} className="w-full rounded-lg" alt="Generated from your prompt" />
					</div>
				)}

				{error && (
					<div className="mt-6 p-4 bg-red-900/50 text-red-200 rounded-lg">
						{error}
					</div>
				)}

				<input
					type="text"
					placeholder="Describe the image..."
					className="w-full mt-6 p-4 rounded-lg text-lg bg-white text-gray-900"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyPress={handleKeyPress}
					disabled={generating}
				/>
				<button
					onClick={handleSubmit}
					disabled={generating || !prompt.trim()}
					className="mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-lg text-xl w-full"
				>
					{generating ? 'Generating...' : 'Submit Guess'}
				</button>
			</div>
		</div>
	);
}

