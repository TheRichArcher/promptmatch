'use client';

import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { pickNextLevel, mostFrequent } from '@/lib/trainingUtils';
import { saveProgress } from '@/lib/progress';
import { useRouter } from 'next/navigation';

type Props = {
	scores: number[];
	feedback: string[];
	onNewSet: () => void;
	onViewProgress: () => void;
};

export default function TrainingSummary({ scores, feedback, onNewSet, onViewProgress }: Props) {
	const [showConfetti, setShowConfetti] = useState(true);
	const improvement = scores[4] - scores[0];
	const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
	const topFeedback = mostFrequent(feedback.filter(Boolean));
	const nextLevel = pickNextLevel(averageScore);
	const router = useRouter();

	useEffect(() => {
		const timer = setTimeout(() => setShowConfetti(false), 5000);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		saveProgress({
			date: new Date().toISOString(),
			averageScore,
			improvement,
			rounds: 5,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-2xl animate-fadeIn">
			{showConfetti ? (
				<Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} />
			) : null}

			<div className="relative z-10 text-center space-y-6">
				<h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
					Training Complete!
				</h2>

				<div className="flex justify-center items-center gap-8 text-2xl font-semibold">
					<div>
						<span className="text-green-600">+{improvement}</span>
						<p className="text-sm text-gray-600">Point Improvement</p>
					</div>
					<div className="w-px h-12 bg-gray-300" />
					<div>
						<span className="text-indigo-600">{averageScore.toFixed(1)}</span>
						<p className="text-sm text-gray-600">Average Score</p>
					</div>
				</div>

				{topFeedback ? (
					<div className="mx-auto max-w-md">
						<p className="text-sm italic text-gray-700 bg-white/70 rounded-xl p-4 shadow">“{topFeedback}”</p>
					</div>
				) : null}

				<div className="flex justify-center gap-4 mt-8">
					<button
						onClick={onNewSet}
						className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:scale-105 transition transform shadow-lg"
					>
						New Training Set
					</button>
					<button
						onClick={() => router.push('/progress')}
						className="bg-white text-gray-800 px-8 py-3 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition shadow"
					>
						View Progress
					</button>
				</div>

				<p className="text-sm text-gray-500 mt-6">
					Next up: <strong className="text-indigo-600">{nextLevel}</strong> – ready to level up?
				</p>
			</div>
		</div>
	);
}


