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
								disabled={generating}
							/>
						</div>
						<button
							onClick={handleSubmit}
							disabled={generating || !prompt.trim()}
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
									<span>Submit Guess</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

