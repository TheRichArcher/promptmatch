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


