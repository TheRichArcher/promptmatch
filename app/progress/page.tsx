'use client';

import { getStats, loadProgress } from '@/lib/progress';
import { pickNextLevel } from '@/lib/trainingUtils';

export default function ProgressPage() {
	const stats = getStats();
	const sessions = loadProgress();
	const nextLevel = pickNextLevel(stats?.avg || 0);

	if (!stats) {
		return (
			<div className="text-center p-12">
				<p className="text-xl">No training data yet.</p>
				<a href="/train" className="btn mt-4">
					Start Training
				</a>
			</div>
		);
	}

	return (
		<div className="max-w-3xl mx-auto p-6 space-y-8">
			<h1 className="text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
				Your Progress
			</h1>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow text-center">
					<p className="text-3xl font-bold text-green-600">{stats.avg.toFixed(1)}</p>
					<p className="text-sm text-gray-600">Average Score</p>
				</div>
				<div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl shadow text-center">
					<p className="text-3xl font-bold text-amber-600">{stats.best.toFixed(1)}</p>
					<p className="text-sm text-gray-600">Best Session</p>
				</div>
				<div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl shadow text-center">
					<p className="text-3xl font-bold text-purple-600">{stats.rounds}</p>
					<p className="text-sm text-gray-600">Total Rounds</p>
				</div>
			</div>

			<div className="bg-white rounded-xl shadow p-6">
				<h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
				<ul className="space-y-2">
					{sessions
						.slice(-5)
						.reverse()
						.map((s, i) => (
							<li key={i} className="flex justify-between items-center py-2 border-b last:border-0">
								<span className="text-sm">{new Date(s.date).toLocaleDateString()}</span>
								<span className="font-medium">{s.averageScore.toFixed(1)}</span>
								<span className="text-xs text-green-600">+{s.improvement}</span>
							</li>
						))}
				</ul>
			</div>

			<div className="text-center p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
				<p className="text-lg">
					Next up: <strong className="text-indigo-600">{nextLevel}</strong>
				</p>
				<a href="/train" className="btn mt-4 inline-block">
					Keep Training
				</a>
			</div>
		</div>
	);
}


