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

