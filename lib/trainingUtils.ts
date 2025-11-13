export function mostFrequent(arr: string[]): string {
	if (arr.length === 0) return 'Keep practicing!';
	return arr
		.sort((a, b) => arr.filter((v) => v === a).length - arr.filter((v) => v === b).length)
		.reverse()[0];
}

export function pickNextLevel(score: number): string {
	if (score < 60) return 'Beginner Pack';
	if (score < 80) return 'Intermediate Pack';
	return 'Advanced Challenge';
}

// Level progression (persists across sessions)
export type LevelState = {
	current: number;
	total: number;
};

const LEVEL_STATE_KEY = 'pm-level-state';

export function loadLevelState(defaultTotal: number = 5): LevelState {
	if (typeof window === 'undefined') return { current: 1, total: defaultTotal };
	try {
		const raw = window.localStorage.getItem(LEVEL_STATE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as LevelState;
			const total = typeof parsed.total === 'number' && parsed.total > 0 ? parsed.total : defaultTotal;
			const current = Math.min(Math.max(1, Number(parsed.current) || 1), total);
			return { current, total };
		}
	} catch {
		// ignore storage errors and fall through to default
	}
	return { current: 1, total: defaultTotal };
}

export function saveLevelState(state: LevelState) {
	if (typeof window === 'undefined') return;
	try {
		const total = Math.max(1, Number(state.total) || 1);
		const current = Math.min(Math.max(1, Number(state.current) || 1), total);
		window.localStorage.setItem(LEVEL_STATE_KEY, JSON.stringify({ current, total }));
	} catch {
		// ignore storage errors
	}
}

export function incrementLevel() {
	const { current, total } = loadLevelState();
	const next = Math.min(current + 1, total);
	saveLevelState({ current: next, total });
	return next;
}

export function resetLevel(total: number = 5) {
	saveLevelState({ current: 1, total });
	return 1;
}

export type RoundState = {
	round: number;
	roundsTotal: number;
};

const ROUND_STATE_KEY = 'pm-round-state';

export function saveRoundState(state: RoundState) {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(ROUND_STATE_KEY, JSON.stringify(state));
	} catch {
		// ignore storage errors
	}
}

export function loadRoundState(): RoundState | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(ROUND_STATE_KEY);
		return raw ? (JSON.parse(raw) as RoundState) : null;
	} catch {
		return null;
	}
}

export function clearRoundState() {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.removeItem(ROUND_STATE_KEY);
	} catch {
		// ignore storage errors
	}
}

