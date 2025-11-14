"use client";

import { useRouter } from 'next/navigation';

export default function TutorialCard() {
	const router = useRouter();
	return (
		<div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-sm border border-indigo-200">
			<h3 className="text-xl font-bold mb-2">Tutorial</h3>
			<p className="text-sm text-gray-700 mb-4">Learn how to win in 3 quick steps. Takes 60 seconds.</p>
			<button
				onClick={() => router.push('/tutorial')}
				className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700"
			>
				Start Tutorial
			</button>
		</div>
	);
}
