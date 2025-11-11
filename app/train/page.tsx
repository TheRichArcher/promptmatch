'use client';

import TrainingMode from '@/components/TrainingMode';

export default function TrainPage() {
	return (
		<main className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Training Mode (5 Rounds)</h1>
					<div className="text-sm text-gray-600">Practice descriptive precision with guided feedback.</div>
				</div>
				<a className="text-sm text-primary-600 hover:underline" href="/">
					Home
				</a>
			</div>
			<TrainingMode />
		</main>
	);
}


