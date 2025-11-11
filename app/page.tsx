export default function HomePage() {
	return (
		<main className="space-y-8">
			<section className="card p-8">
				<h1 className="mb-2 text-3xl font-bold">Ready to train your AI eye?</h1>
				<p className="mb-6 text-gray-600">
					Recreate a hidden image using only your prompt. The closer the match, the higher your score. Learn by doing with quick feedback.
				</p>
				<div className="flex flex-wrap gap-3">
					<a className="btn" href="/train">
						Start Training
					</a>
					<button className="btn bg-gray-900 hover:bg-black" disabled>
						Daily Challenge (coming soon)
					</button>
				</div>
			</section>
			<section className="grid gap-4 md:grid-cols-3">
				<div className="card p-6">
					<h3 className="mb-1 text-lg font-semibold">🪄 Tutorial</h3>
					<p className="text-sm text-gray-600">Simple shapes & objects with guided tips.</p>
				</div>
				<div className="card p-6">
					<h3 className="mb-1 text-lg font-semibold">🧠 Daily Challenge</h3>
					<p className="text-sm text-gray-600">Everyone gets the same image each day. Share and compete.</p>
				</div>
				<div className="card p-6">
					<h3 className="mb-1 text-lg font-semibold">⚔️ Duels</h3>
					<p className="text-sm text-gray-600">Prompt vs Prompt — beat another player’s match.</p>
				</div>
			</section>
		</main>
	);
}


