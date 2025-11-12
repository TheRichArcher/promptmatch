export type TrainingResult = {
	date: string;
	averageScore: number;
	improvement: number;
	rounds: number;
};

const KEY = 'promptmatch-progress';

export function loadProgress(): TrainingResult[] {
	if (typeof window === 'undefined') return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) || '[]');
	} catch {
		return [];
	}
}

export function saveProgress(result: TrainingResult) {
	const progress = loadProgress();
	progress.push(result);
	localStorage.setItem(KEY, JSON.stringify(progress));
}

export function getStats() {
	const progress = loadProgress();
	if (!progress.length) return null;

	const avg = progress.reduce((a, b) => a + b.averageScore, 0) / progress.length;
	const best = Math.max(...progress.map((p) => p.averageScore));
	const rounds = progress.reduce((a, b) => a + b.rounds, 0);

	return { avg, best, rounds, sessions: progress.length };
}


