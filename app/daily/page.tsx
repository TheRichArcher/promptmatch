'use client';

import { useState, useEffect } from 'react';

export default function DailyChallenge() {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [prompt, setPrompt] = useState('');
	const [generatedImage, setGeneratedImage] = useState<string | null>(null);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [score, setScore] = useState<number | null>(null);
	const [rank, setRank] = useState<number | null>(null);
	const [submitted, setSubmitted] = useState(false);

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
		if (!prompt.trim() || generating || submitted) return;

		setGenerating(true);
		setError(null);
		setGeneratedImage(null);
		setScore(null);
		setRank(null);

		try {
			// Generate image
			const genRes = await fetch('/api/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ prompt: prompt.trim() }),
			});

			const genResult = await genRes.json();

			if (!genRes.ok) {
				throw new Error(genResult.error || 'Failed to generate image');
			}

			const imageUrl = genResult.imageDataUrl || genResult.image;
			if (!imageUrl) {
				throw new Error('No image returned');
			}

			setGeneratedImage(imageUrl);

			// Score the prompt
			const scoreRes = await fetch('/api/score', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: prompt.trim(),
					targetImage: data.targetImage,
					generatedImage: imageUrl,
					targetMeta: {
						label: `Daily Challenge Day ${data.day}`,
						tier: 'medium',
					},
				}),
			});

			const scoreResult = await scoreRes.json();

			if (scoreRes.ok && scoreResult.aiScore !== undefined) {
				const finalScore = Math.round(scoreResult.aiScore);
				setScore(finalScore);
				// Mock rank for now (would come from backend in real implementation)
				setRank(Math.floor(Math.random() * 20) + 1);
				setSubmitted(true);
			} else {
				// If scoring fails, still show the image but no score
				setSubmitted(true);
			}
		} catch (err: any) {
			setError(err?.message || 'Failed to generate image');
			console.error('Generation error:', err);
		} finally {
			setGenerating(false);
		}
	};

	const handleShare = async () => {
		if (score === null || !data) return;

		const shareText = `I scored ${score} on PromptMatch Daily #${data.day} 🔥\nBeat me → promptmatch.onrender.com/daily`;

		try {
			await navigator.clipboard.writeText(shareText);
			// Show a brief success message (could enhance with toast)
			alert('Copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy:', err);
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
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
			<div className="max-w-5xl mx-auto">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-5xl font-bold text-gray-900 mb-3">PromptMatch Daily</h1>
					<p className="text-xl text-gray-600 mb-2">One prompt. Best score wins.</p>
					<div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
						<span className="text-sm font-semibold text-gray-700">Day {data.day}</span>
					</div>
				</div>

				{/* Main Card */}
				<div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-gray-100">
					{/* Side by side images */}
					<div className="grid grid-cols-1 gap-8 md:grid-cols-2 mb-8">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
								<p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Target Image</p>
							</div>
							<div className="rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 bg-gray-50 aspect-square">
								<img 
									src={data.targetImage} 
									className="w-full h-full object-cover" 
									alt="Daily challenge target" 
								/>
							</div>
						</div>
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 bg-purple-500 rounded-full"></div>
								<p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Image</p>
							</div>
							<div className="rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 bg-gray-50 aspect-square flex items-center justify-center">
								{generatedImage ? (
									<img 
										src={generatedImage} 
										className="w-full h-full object-cover" 
										alt="Generated from your prompt" 
									/>
								) : (
									<div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
										<div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mb-4">
											<svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
											</svg>
										</div>
										<p className="text-sm text-gray-500 font-medium">Your generated image will appear here</p>
										<p className="text-xs text-gray-400 mt-1">Enter a prompt and click submit</p>
									</div>
								)}
							</div>
						</div>
					</div>

					{error && (
						<div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
							<svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
							</svg>
							<span>{error}</span>
						</div>
					)}

					{/* Score Display */}
					{score !== null && (
						<div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
							<div className="text-center">
								<p className="text-3xl font-bold text-gray-900 mb-2">
									Your score: {score}/100 🔥
								</p>
								{rank !== null && (
									<p className="text-lg text-gray-700 mb-4">
										You're #{rank} today — beat tomorrow!
									</p>
								)}
								<button
									onClick={handleShare}
									className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
									</svg>
									Share
								</button>
							</div>
						</div>
					)}

					{/* Input Section */}
					<div className="space-y-4">
						<div className="relative">
							<input
								type="text"
								placeholder="Describe the image you see..."
								className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all bg-white text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyPress={handleKeyPress}
								disabled={generating || submitted}
							/>
						</div>
						<button
							onClick={handleSubmit}
							disabled={generating || !prompt.trim() || submitted}
							className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
						>
							{generating ? (
								<>
									<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span>Generating...</span>
								</>
							) : (
								<>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
									</svg>
									<span>Submit Prompt</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

