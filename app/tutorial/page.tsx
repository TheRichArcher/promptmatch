'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { TUTORIAL_IMAGE_SRC, evaluateTutorialPrompt } from '@/lib/tutorial';

export default function TutorialPage() {
	const router = useRouter();
	const [step, setStep] = useState<number>(1);
	const [userPrompt, setUserPrompt] = useState<string>('');
	const [showResult, setShowResult] = useState<boolean>(false);
	const result = useMemo(() => evaluateTutorialPrompt(userPrompt), [userPrompt]);

	const handleFakeScore = useCallback(() => {
		setShowResult(true);
	}, []);

	return (
		<main className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<div className="text-xs text-gray-500">Tutorial Wizard</div>
					<h1 className="text-2xl font-bold">
						Step {step}
						<span className="text-gray-400">/3</span>
					</h1>
				</div>
				<a className="text-sm text-primary-600 hover:underline" href="/">
					Home
				</a>
			</div>

			<section className="card p-6 space-y-6 animate-fadeIn">
				{step === 1 && (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-center">How PromptMatch Works</h2>

						<div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
							<div>
								<div className="bg-gray-200 border-2 border-dashed rounded-xl w-24 h-24 mx-auto mb-2" />
								<p className="font-semibold">1. See the Target</p>
								<p className="text-xs text-gray-600">Study every detail</p>
							</div>
							<div>
								<div className="bg-blue-100 rounded-xl p-2 mx-auto mb-2 w-24 h-24 flex items-center justify-center">
									<span className="text-xs font-mono">Write prompt here</span>
								</div>
								<p className="font-semibold">2. Write Prompt</p>
								<p className="text-xs text-gray-600">Describe exactly</p>
							</div>
							<div>
								<div className="bg-green-100 rounded-xl p-2 mx-auto mb-2 w-24 h-24 flex items-center justify-center">
									<span className="text-2xl font-bold text-green-700">95</span>
								</div>
								<p className="font-semibold">3. Get Score</p>
								<p className="text-xs text-gray-600">Higher = better match</p>
							</div>
						</div>

						<button onClick={() => setStep(2)} className="btn w-full">
							Try It Now
						</button>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-6">
						<h2 className="text-xl font-bold text-center">Your First Prompt</h2>

						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							<div>
								<p className="text-sm font-semibold mb-2">Target Image</p>
								<div className="rounded-lg shadow overflow-hidden bg-white">
									<img
										src={TUTORIAL_IMAGE_SRC}
										alt="Red ball on white table"
										className="block max-h-64 w-full object-cover"
										onError={(e) => {
											// gracefully fallback if image is missing
											const target = e.currentTarget as HTMLImageElement;
											target.style.display = 'none';
											const parent = target.parentElement;
											if (parent && !parent.querySelector('[data-fallback]')) {
												const fallback = document.createElement('div');
												fallback.setAttribute('data-fallback', 'true');
												fallback.className =
													'flex h-64 items-center justify-center bg-gray-50';
												fallback.innerHTML =
													'<div class="h-24 w-24 rounded-full bg-red-500 shadow-inner"></div>';
												parent.appendChild(fallback);
											}
										}}
									/>
								</div>
							</div>
							<div>
								<p className="text-sm font-semibold mb-2">Your Prompt</p>
								<textarea
									placeholder="Try: red ball on white table"
									className="w-full p-3 border rounded-lg"
									value={userPrompt}
									onChange={(e) => {
										setUserPrompt(e.target.value);
										setShowResult(false);
									}}
									rows={5}
								/>
								<button
									onClick={handleFakeScore}
									className="mt-2 btn w-full"
									disabled={!userPrompt.trim()}
								>
									Generate &amp; Score
								</button>
							</div>
						</div>

						{showResult && (
							<div className="bg-green-50 p-4 rounded-lg text-center">
								<p className="text-3xl font-bold text-green-700">{result.score}</p>
								<p className="mt-2">{result.message}</p>
								<p className="text-xs mt-2 font-mono text-green-800">
									Gold Prompt: &quot;{result.goldPrompt}&quot;
								</p>
							</div>
						)}

						<button onClick={() => setStep(3)} className="btn w-full">
							Next: Pro Tips
						</button>
					</div>
				)}

				{step === 3 && (
					<div className="space-y-6">
						<h2 className="text-xl font-bold text-center">Pro Tips for 90+ Scores</h2>

						<div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
							<div className="bg-blue-50 p-3 rounded-lg">
								Include color + shape
								<div className="text-xs mt-1 font-mono">&quot;red circle&quot;</div>
							</div>
							<div className="bg-purple-50 p-3 rounded-lg">
								Add size + placement
								<div className="text-xs mt-1 font-mono">&quot;large in center&quot;</div>
							</div>
							<div className="bg-yellow-50 p-3 rounded-lg">
								Use specific objects
								<div className="text-xs mt-1 font-mono">&quot;wooden desk&quot;</div>
							</div>
							<div className="bg-pink-50 p-3 rounded-lg">
								Mention lighting
								<div className="text-xs mt-1 font-mono">&quot;golden hour&quot;</div>
							</div>
						</div>

						<button
							onClick={() => {
								try {
									localStorage.setItem('tutorialComplete', 'true');
								} catch {
									// ignore
								}
								router.push('/train');
							}}
							className="btn w-full text-lg py-3"
						>
							Start Training Mode
						</button>

						<p className="text-center text-xs text-gray-500">
							<a
								href="#"
								onClick={(e) => {
									e.preventDefault();
									setStep(1);
									setUserPrompt('');
									setShowResult(false);
								}}
								className="underline"
							>
								Restart Tutorial
							</a>
						</p>
					</div>
				)}
			</section>
		</main>
	);
}


