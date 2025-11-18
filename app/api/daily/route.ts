import { NextResponse } from 'next/server';
import { generateAndCacheImage } from '@/lib/gemini';

export const runtime = 'nodejs';

const DAILY_PROMPTS = [
	// Day 1 – Nov 17
	'majestic white dragon soaring through golden hour clouds, backlit sun rays piercing through mist, volumetric lighting, epic fantasy, ultra-detailed, --ar 16:9',

	// Day 2 – Nov 18
	'close-up portrait of woman under umbrella in heavy rain at night, neon reflections on wet street, 85mm lens, cinematic lighting, shallow depth of field, --no blur --no watermark, masterpiece, --ar 9:16',

	// Day 3 – Nov 19
	'vintage red Cadillac parked at neon-lit diner at dusk, 35mm film, moody color grading, retro aesthetic, --no people --no modern cars, highly detailed, --ar 16:9',

	// Day 4 – Nov 20
	'cozy still life of coffee and open notebook on wooden desk near window, soft morning light, 50mm lens look, subtle film grain, --no people, --ar 3:2, masterpiece',

	// Day 5 – Nov 21
	'cyberpunk alley with neon signs in rain, reflective puddles, low angle 24mm, cinematic color grading, --no people, --ar 16:9, ultra-detailed',

	// Day 6 – Nov 22
	'mysterious ancient temple hidden in misty jungle, golden sunset rays filtering through vines, cinematic, --no people, --ar 16:9, highly detailed',

	// Day 7 – Nov 23
	'floating crystal islands in a purple nebula, glowing ethereal bridges, space fantasy, ultra-detailed, --ar 1:1, masterpiece',

	// Day 8 – Nov 24
	'steampunk airship soaring over Victorian city at dusk, brass gears and smoke, cinematic lighting, --no modern elements, --ar 16:9, highly detailed',

	// Day 9 – Nov 25
	'enchanted forest with bioluminescent mushrooms and fireflies, magical atmosphere, soft glow, --no animals, --ar 4:3, masterpiece',

	// Day 10 – Nov 26
	'post-apocalyptic ruined city overgrown with vines, dramatic storm sky, cinematic, --no people, --ar 16:9, ultra-detailed',

	// Day 11 – Nov 27
	'minimalist zen garden with raked sand and single stone, morning mist, peaceful, --no people, --ar 16:9, highly detailed',

	// Day 12 – Nov 28
	'futuristic space station interior with holographic displays, clean lines, sci-fi aesthetic, --no people, --ar 16:9, ultra-detailed',

	// Day 13 – Nov 29
	'vintage typewriter on wooden desk with scattered papers, warm desk lamp, nostalgic, --no people, --ar 3:2, masterpiece',

	// Day 14 – Nov 30
	'underwater coral reef with colorful fish, dappled sunlight, vibrant, --no people, --ar 16:9, highly detailed',

	// Day 15 – Dec 1
	'medieval castle on cliff overlooking stormy sea, dramatic clouds, epic, --no people, --ar 16:9, ultra-detailed',

	// Day 16 – Dec 2
	'neon-lit Tokyo street at night, rain-soaked, cyberpunk atmosphere, --no people, --ar 16:9, cinematic',

	// Day 17 – Dec 3
	'desert landscape with cacti silhouetted against sunset, warm tones, --no people, --ar 16:9, highly detailed',

	// Day 18 – Dec 4
	'vintage library with tall bookshelves and ladder, warm lighting, cozy, --no people, --ar 3:2, masterpiece',

	// Day 19 – Dec 5
	'aurora borealis over snow-covered forest, magical, ethereal, --no people, --ar 16:9, ultra-detailed',

	// Day 20 – Dec 6
	'steam locomotive crossing bridge over valley, vintage, cinematic, --no people, --ar 16:9, highly detailed',

	// Day 21 – Dec 7
	'floating market boats on river at dawn, misty, atmospheric, --no people, --ar 16:9, cinematic',

	// Day 22 – Dec 8
	'ancient ruins overgrown with ivy, golden hour, mysterious, --no people, --ar 16:9, highly detailed',

	// Day 23 – Dec 9
	'vintage camera collection on wooden shelf, warm light, nostalgic, --no people, --ar 3:2, masterpiece',

	// Day 24 – Dec 10
	'ice cave with blue glow, otherworldly, ethereal, --no people, --ar 16:9, ultra-detailed',

	// Day 25 – Dec 11
	'retro diner interior with neon signs, 1950s aesthetic, --no people, --ar 16:9, highly detailed',

	// Day 26 – Dec 12
	'mountain peak piercing clouds, dramatic, epic, --no people, --ar 16:9, cinematic',

	// Day 27 – Dec 13
	'vintage record player with vinyl, warm lighting, cozy, --no people, --ar 3:2, masterpiece',

	// Day 28 – Dec 14
	'bioluminescent beach at night, magical, ethereal, --no people, --ar 16:9, ultra-detailed',

	// Day 29 – Dec 15
	'steampunk workshop with gears and brass, intricate details, --no people, --ar 16:9, highly detailed',

	// Day 30 – Dec 16
	'floating islands connected by bridges, fantasy landscape, epic, --no people, --ar 16:9, cinematic',
];


export async function GET() {
	try {
		const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
		const launchDate = '2025-11-17';
		const dayNumber = Math.floor((new Date(today).getTime() - new Date(launchDate).getTime()) / 86400000) + 1;
		const prompt = DAILY_PROMPTS[dayNumber - 1] || DAILY_PROMPTS[0];

		const imageUrl = await generateAndCacheImage(prompt, today);

		return NextResponse.json({
			day: dayNumber,
			targetImage: imageUrl,
			guessesLeft: 6,
			shareUrl: 'https://promptmatch.onrender.com/daily',
		});
	} catch (err: any) {
		console.error('[daily] Error:', err?.message ?? err);
		return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
	}
}

