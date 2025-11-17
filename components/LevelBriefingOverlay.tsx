'use client';

import { motion } from 'framer-motion';

const BRIEFINGS: Record<
	string,
	{
		title: string;
		desc: string;
		focus: string[];
		examples: string[];
		tip: string;
	}
> = {
	basics: {
		title: 'Basics: Describe the Thing Clearly',
		desc: 'Simple 2D shapes · 2–3 words · 8th grade level',
		focus: ['Name the object', 'Pick a color', 'Keep it short'],
		examples: ['red circle', 'yellow star', 'blue square'],
		tip: 'Short and concrete wins here.',
	},
	details: {
		title: 'Details: Add Light + Texture',
		desc: 'Start with the object and color, then add how it feels and how it’s lit.',
		focus: [
			'Name the object (cup, apple, duck, sphere)',
			'Add the color (red, blue, green, yellow)',
			'Add one texture word (shiny, matte, fuzzy, glossy)',
			'Add one light word (soft shadows, warm light, glowing, backlit)',
		],
		examples: ['blue plastic cup, matte surface, warm light', 'shiny red apple with soft light'],
		tip: 'Start with the object and color, then add surface + light. That’s it.',
	},
	scenes: {
		title: 'Scenes: Build the World',
		desc: 'Place your object in a real environment. No floating. No blank backgrounds.',
		focus: [
			'Object + color',
			'Texture + light',
			'A surface (on a desk, on the ground, on a shelf)',
			'A simple setting around it (kitchen, forest, workshop)',
		],
		examples: [
			'shiny red apple on wooden counter with soft morning light',
			'yellow robot on metal workbench in a garage',
		],
		tip: 'Put your object somewhere real. Give it a stage.',
	},
	style: {
		title: 'Style: Direct the Camera',
		desc: 'You’re the artist. Keep everything you’ve learned — now control how it looks.',
		focus: [
			'Object + color',
			'Texture + light',
			'Real scene (surface + setting)',
			'Now add artistic direction:',
			'Camera: close-up, wide angle, 50mm lens, low angle',
			'Medium: digital painting, oil on canvas, film photo',
			'Aesthetic: cinematic, Pixar style, cyberpunk, vintage polaroid',
		],
		examples: [
			'close-up of a shiny red apple on wooden kitchen counter, dramatic overhead light, shot on 35mm film, cinematic',
			'yellow rubber duck floating in clear pool water at golden hour, wide angle lens, rendered in Pixar animation style',
		],
		tip: 'Start with your best Level 3 prompt — then add the style!',
	},
	precision: {
		title: 'Precision: Engineer the Output',
		desc: 'Full control. Keep everything — now eliminate flaws.',
		focus: [
			'Stack so far:',
			'Object + color',
			'Texture + light',
			'Real scene',
			'Artistic direction',
			'Now add precision:',
			'Negative: --no blur, scratches, text',
			'Aspect ratio: --ar 16:9 / 9:16 / 1:1',
			'Weighting: (masterpiece), ((detailed))',
			'Quality: masterpiece, ultra-detailed',
		],
		examples: [
			'close-up portrait of woman under umbrella in rain at night, 85mm lens, cinematic, --no blur --no watermark --ar 9:16, masterpiece',
			'vintage red Cadillac at neon diner dusk, 35mm film, moody grading, --no people --no modern cars --ar 16:9, highly detailed',
		],
		tip: 'Start with your best Level 4 prompt — then engineer it!',
	},
};

export default function LevelBriefingOverlay({ level }: { level: string }) {
	const data = BRIEFINGS[level] ?? BRIEFINGS['basics'];

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="fixed inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 z-50 flex items-center justify-center p-6"
		>
			<div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
				<h2 className="text-3xl font-bold text-indigo-700 mb-2">{data.title}</h2>
				<p className="text-sm text-gray-600 mb-6">{data.desc}</p>

				<div className="space-y-3 mb-6">
					{data.focus.map((item, i) => (
						<div key={i} className="flex items-center gap-2">
							<div className="w-2 h-2 bg-indigo-500 rounded-full" />
							<span className="text-gray-700">{item}</span>
						</div>
					))}
				</div>

				<div className="bg-gray-50 p-4 rounded-xl mb-4">
					<p className="text-sm font-semibold text-gray-700 mb-2">Try these:</p>
					<div className="flex flex-wrap gap-2">
						{data.examples.map((ex, i) => (
							<code key={i} className="bg-white px-3 py-1 rounded-lg text-sm text-indigo-600">
								"{ex}"
							</code>
						))}
					</div>
				</div>

				<p className="text-xs italic text-indigo-600 mb-6">💡 {data.tip}</p>

				<div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
					<motion.div
						className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
						initial={{ width: 0 }}
						animate={{ width: '100%' }}
						transition={{ duration: 30, ease: 'linear' }}
					/>
				</div>
				<p className="text-center text-sm text-gray-500 mt-2">Preparing your 5 new images...</p>
			</div>
		</motion.div>
	);
}


