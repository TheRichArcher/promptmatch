'use client';

import React from 'react';
import type { Tier } from '@/lib/tiers';

type ProgressHeaderProps = {
	tier: Tier;
	round: number;
	roundsTotal: number;
	isFreePlay?: boolean;
};

export default function ProgressHeader({ tier, round, roundsTotal, isFreePlay = false }: ProgressHeaderProps) {
	const ORDER: Tier[] = ['easy', 'medium', 'hard', 'advanced', 'expert'];
	const tierIdx = Math.max(0, ORDER.findIndex((t) => t === tier)) + 1;
	const totalLevels = ORDER.length;
	const progress = Math.min(100, Math.max(0, (round / Math.max(1, roundsTotal)) * 100));

	return (
		<div className="w-full space-y-1">
			<div className="flex justify-between text-sm text-gray-600">
				<span>
					{isFreePlay ? (
						<span className="font-bold text-green-600">Free Play Mode</span>
					) : (
						<>Level {tierIdx} of {totalLevels}</>
					)}
				</span>
				<span>Round {round} of {roundsTotal}</span>
			</div>
			<div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
				<div
					className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}


