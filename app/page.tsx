export default function HomePage() {
	function ModeCard({
		title,
		description,
		href,
		disabled = false,
		style,
	}: {
		title: string;
		description: string;
		href?: string;
		disabled?: boolean;
		style?: React.CSSProperties;
	}) {
		if (disabled || !href) {
			return (
				<div className="card p-6 opacity-50 cursor-not-allowed animate-fadeIn" style={style} aria-disabled="true">
					<h3 className="mb-1 text-lg font-semibold">{title}</h3>
					<p className="text-sm text-gray-600">{description}</p>
				</div>
			);
		}
		return (
			<a
				className="card p-6 transition-transform hover:scale-[1.01] hover:shadow-md animate-fadeIn"
				href={href}
				style={style}
			>
				<h3 className="mb-1 text-lg font-semibold">{title}</h3>
				<p className="text-sm text-gray-600">{description}</p>
			</a>
		);
	}

	return (
		<main className="space-y-8">
			<section className="card p-8 animate-fadeIn">
				<h1 className="mb-2 text-3xl font-bold">Welcome to PromptMatch</h1>
				<p className="mb-6 text-gray-600">
					Sharpen your visual prompting skills through quick, five-round training games. Describe what you see — the closer your prompt, the higher your score.
				</p>
				<div className="flex flex-wrap gap-3 animate-fadeIn" style={{ animationDelay: '120ms' }}>
					<a className="btn" href="/train">
						Start Training
					</a>
					<button className="btn bg-gray-900 hover:bg-black" disabled>
						Daily Challenge (coming soon)
					</button>
				</div>
			</section>
			<section className="grid gap-4 md:grid-cols-3">
				<ModeCard
					title="🪄 Tutorial"
					description="Simple shapes & objects with guided tips."
					href="/tutorial"
					style={{ animationDelay: '80ms' }}
				/>
				<ModeCard
					title="🧠 Daily Challenge (coming soon)"
					description="Everyone gets the same image each day. Share and compete."
					disabled
					style={{ animationDelay: '140ms' }}
				/>
				<ModeCard
					title="⚔️ Duels (coming soon)"
					description="Prompt vs Prompt — beat another player’s match."
					disabled
					style={{ animationDelay: '200ms' }}
				/>
			</section>
		</main>
	);
}


