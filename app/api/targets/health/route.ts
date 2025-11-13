import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getPoolForTier } from '@/lib/tieredTargets';

export const runtime = 'nodejs';

function countImages(dir: string): number {
	try {
		if (!fs.existsSync(dir)) return 0;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		return entries.filter((e) => e.isFile() && ['.png', '.jpg', '.jpeg', '.svg'].includes(path.extname(e.name).toLowerCase())).length;
	} catch {
		return 0;
	}
}

export async function GET(_req: NextRequest) {
	try {
		const projectRoot = process.cwd();
		const trainingBase = path.join(projectRoot, 'public', 'targets', 'training');
		const challengeBase = path.join(projectRoot, 'public', 'targets', 'challenge');
		const result = {
			training: {
				easy: countImages(path.join(trainingBase, 'easy')),
				medium: countImages(path.join(trainingBase, 'medium')),
				hard: countImages(path.join(trainingBase, 'hard')),
			},
			challenge: {
				advanced: countImages(path.join(challengeBase, 'advanced')),
				expert: countImages(path.join(challengeBase, 'expert')),
			},
			pools: {
				easy: getPoolForTier(projectRoot, 'easy').absPaths.length,
				medium: getPoolForTier(projectRoot, 'medium').absPaths.length,
				hard: getPoolForTier(projectRoot, 'hard').absPaths.length,
				advanced: getPoolForTier(projectRoot, 'advanced').absPaths.length,
				expert: getPoolForTier(projectRoot, 'expert').absPaths.length,
			},
		};
		return NextResponse.json(result, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


