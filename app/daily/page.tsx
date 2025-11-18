'use client';

import { useState, useEffect } from 'react';

export default function DailyChallenge() {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);

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

	if (loading) return <div className="text-center p-8">Loading today's challenge...</div>;

	if (!data || data.error) return <div className="text-center p-8">Error loading challenge</div>;

	return (
		<div className="max-w-2xl mx-auto pt-10 px-6">
			<h1 className="text-4xl font-bold text-center mb-4">PromptMatch Daily</h1>
			<p className="text-center text-xl mb-8">One image. 6 guesses. Same for everyone.</p>
			<div className="bg-gray-900 rounded-xl p-8">
				<div className="text-center mb-4 text-white">Day {data.day} • {data.guessesLeft} guesses left</div>
				<img src={data.targetImage} className="w-full rounded-lg" alt="Daily challenge target" />
				<input
					type="text"
					placeholder="Describe the image..."
					className="w-full mt-6 p-4 rounded-lg text-lg bg-white text-gray-900"
				/>
				<button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl w-full">
					Submit Guess
				</button>
			</div>
		</div>
	);
}

