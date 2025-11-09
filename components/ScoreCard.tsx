export type Feedback = {
	tips: string[];
	note?: string;
};

export default function ScoreCard({
	aiScore,
	feedback,
}: {
	aiScore: number;
	feedback: Feedback | null;
}) {
	return (
		<div className="card p-4">
			<div className="flex items-end justify-between">
				<div>
					<div className="text-sm uppercase tracking-wide text-gray-500">AI Score</div>
					<div className="text-4xl font-bold">{Math.round(aiScore)}</div>
				</div>
				<div className="text-right text-sm text-gray-500">
					Final score is computed from semantic similarity and prompt structure bonuses.
				</div>
			</div>
			{feedback ? (
				<div className="mt-4 space-y-2">
					<div className="text-sm font-semibold">Improvement tips</div>
					<ul className="list-inside list-disc text-sm text-gray-700">
						{feedback.tips.map((t, idx) => (
							<li key={idx}>{t}</li>
						))}
					</ul>
					{feedback.note ? <div className="text-sm text-gray-500">{feedback.note}</div> : null}
				</div>
			) : null}
		</div>
	);
}


