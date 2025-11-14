'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TutorialCard from '@/components/TutorialCard';

export default function HomePage() {
	const [showModal, setShowModal] = useState(false);
	const router = useRouter();

	useEffect(() => {
		try {
			const done = localStorage.getItem('tutorialComplete');
			if (!done) {
				setShowModal(true);
			}
		} catch {
			// ignore storage errors
		}
	}, []);

	function startTutorial() {
		setShowModal(false);
		router.push('/tutorial');
	}

	function skip() {
		setShowModal(false);
		try {
			// Mark as not completed so modal won't show again, but card will pulse
			localStorage.setItem('tutorialComplete', 'false');
		} catch {
			// ignore
		}
	}

	return (
		<>
			{/* Welcome Modal */}
			{showModal ? (
				<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
						<h2 className="text-2xl font-bold mb-3">Welcome to PromptMatch!</h2>
						<p className="text-gray-600 mb-6">Learn how to describe images like an AI pro — in under a minute.</p>
						<div className="flex gap-3">
							<button onClick={startTutorial} className="btn flex-1">
								Start Tutorial
							</button>
							<button onClick={skip} className="btn flex-1 bg-gray-900 hover:bg-black">
								Skip for now
							</button>
						</div>
					</div>
				</div>
			) : null}

			{/* Main Content */}
			<div className="max-w-4xl mx-auto p-6">
				<h1 className="text-4xl font-bold text-center mb-2">PromptMatch</h1>
				<p className="text-center text-gray-600 mb-8">New here? Try the tutorial — master visual prompting in 60 seconds.</p>

				{/* Tutorial Card — PULSING */}
				<div className="animate-pulse ring-2 ring-indigo-400 ring-offset-2 rounded-2xl mb-6">
					<TutorialCard />
				</div>

				<hr className="my-8 border-gray-300" />

				{/* Training Buttons */}
				<div className="flex gap-4 justify-center">
					<button onClick={() => router.push('/train')} className="btn text-lg px-8">
						Start Training
					</button>
					<button disabled className="btn bg-gray-900 hover:bg-black text-lg px-8">
						Daily Challenge (coming soon)
					</button>
				</div>
			</div>
		</>
	);
}


