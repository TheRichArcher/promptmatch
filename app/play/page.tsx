'use client';

import { useCallback, useMemo, useState } from 'react';
import CanvasPreview from '@/components/CanvasPreview';
import PromptInput from '@/components/PromptInput';
import ScoreCard from '@/components/ScoreCard';
import { trainingLevels } from '@/lib/levels';

type ScoreResponse = {
	aiScore: number;
	similarity01: number;
	bonus: number;
	feedback: { tips: string[]; note?: string };
};

export default function TrainingPage() {
	const level = useMemo(() => trainingLevels[0], []);
	const [isLoading, setIsLoading] = useState(false);
	const [generatedImage, setGeneratedImage] = useState<string | null>(null);
	const [score, setScore] = useState<ScoreResponse | null>(null);
	const [lastPrompt, setLastPrompt] = useState<string>('');

	const onSubmit = useCallback(
		async (prompt: string) => {
			setIsLoading(true);
			setScore(null);
			setLastPrompt(prompt);
			try {
				// 1) Generate image (stubbed unless Gemini image is configured)
				const genResp = await fetch('/api/generate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt }),
				});
				const genRes = await genResp.json();
				if (!genResp.ok || genRes?.error) {
					throw new Error(genRes?.error || 'Failed to generate image');
				}
				setGeneratedImage(genRes?.image || genRes?.imageUrl || genRes?.imageDataUrl || null);

				// 2) Score similarity using embeddings (if key) and heuristics
				const scoreResp = await fetch('/api/score', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt, targetDescription: level.description }),
				});
				const scoreRes: ScoreResponse = await scoreResp.json();
				if (!scoreResp.ok || (scoreRes as any)?.error) {
					throw new Error((scoreRes as any)?.error || 'Failed to score image');
				}
				setScore(scoreRes as any);
			} catch (e) {
				console.error(e);
				alert((e as Error)?.message || 'Something went wrong. Check console for details.');
			} finally {
				setIsLoading(false);
			}
		},
		[level],
	);

	return (
		<main className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Training Mode</h1>
					<div className="text-sm text-gray-600">Level: {level.title}</div>
				</div>
				<a className="text-sm text-primary-600 hover:underline" href="/">
					Back to Home
				</a>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<div className="card p-4">
					<h2 className="mb-3 text-lg font-semibold">Target</h2>
					<CanvasPreview spec={level.spec} label="Original" />
					<p className="mt-3 text-sm text-gray-600">
						Describe what you see. For best results, mention color, size, placement, and background.
					</p>
				</div>
				<div className="card p-4">
					<h2 className="mb-3 text-lg font-semibold">Your Result</h2>
					<CanvasPreview imageDataUrl={generatedImage} spec={!generatedImage ? { ...level.spec } : undefined} label={generatedImage ? 'Generated' : 'Placeholder'} />
					<div className="mt-3">
						<PromptInput onSubmit={onSubmit} isGenerating={isLoading} defaultPrompt={level.examplePrompt} />
					</div>
				</div>
			</div>

			{score ? (
				<div className="grid gap-6 md:grid-cols-2">
					<ScoreCard aiScore={score.aiScore} feedback={score.feedback} />
					<div className="card p-4">
						<div className="text-sm text-gray-500">
							<span className="font-semibold">Details</span>
							<div>Prompt: <span className="text-gray-700">{lastPrompt}</span></div>
							<div>
								Similarity: {(score.similarity01 * 100).toFixed(1)}% • Bonus: +{score.bonus.toFixed(1)}
							</div>
						</div>
						<div className="mt-3 text-xs text-gray-500">
							Note: With a configured API key, embeddings are used. Without one, a prompt-text fallback similarity is applied so you can train offline.
						</div>
					</div>
				</div>
			) : null}
		</main>
	);
}


