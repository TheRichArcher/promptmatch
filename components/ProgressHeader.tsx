'use client';

import React from 'react';
import { CURRICULUM, type Tier } from '@/lib/tiers';

type ProgressHeaderProps = {
	tier: Tier;
	round: number;
	roundsTotal: number;
	isFreePlay?: boolean;
};

export default function ProgressHeader({ tier, round, roundsTotal, isFreePlay = false }: ProgressHeaderProps) {
	const ORDER: Tier[] = ['easy', 'medium', 'hard', 'advanced', 'expert'];
	const tierIndex = Math.max(0, ORDER.findIndex((t) => t === tier));
	const currentLevel = CURRICULUM.find((l) => l.id === tier);
	// Progress should reflect the current round within this level, not global across tiers
	const clampedTotal = Math.max(1, roundsTotal || 5);
	const clampedRound = Math.min(Math.max(1, round), clampedTotal);
	const roundProgress = Math.min(100, Math.max(0, (clampedRound / clampedTotal) * 100));

	return (
		<div className="w-full space-y-1">
			<div className="flex justify-between text-sm">
				<span>
					{isFreePlay ? (
						<span className="font-bold text-green-600">Free Play Mode</span>
					) : (
						<span className="font-bold">{currentLevel?.name || `Level ${tierIndex + 1}`}</span>
					)}
				</span>
				<span>Round {clampedRound} of {clampedTotal}</span>
			</div>
			<div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
					style={{ width: `${roundProgress}%` }}
				/>
			</div>
			<div className="text-sm font-bold text-purple-700 text-center">
				{currentLevel?.name || `Level ${tierIndex + 1}`} → Precision
			</div>
		</div>
	);
}


