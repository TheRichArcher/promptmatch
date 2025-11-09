import { NextRequest } from 'next/server';
import { computeFinalScore, embeddingSimilarity, heuristicPromptBonus, jaccardSimilarity } from '@/lib/scoring';
import { generatePromptFeedback } from '@/lib/feedback';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const prompt = String(body?.prompt ?? '');
		const targetDescription = String(body?.targetDescription ?? '');

		if (!prompt || !targetDescription) {
			return new Response(JSON.stringify({ error: 'Missing prompt or targetDescription' }), { status: 400 });
		}

		const apiKey = process.env.GOOGLE_API_KEY;
		let similarity01: number | null = null;
		try {
			similarity01 = await embeddingSimilarity({
				prompt,
				targetDescription,
				apiKey: apiKey || undefined,
				useVision: true,
			});
		} catch {
			// ignore and fallback
		}

		// Fallback similarity if embeddings unavailable
		if (similarity01 === null) {
			similarity01 = jaccardSimilarity(prompt, targetDescription);
		}

		const bonus = heuristicPromptBonus(prompt);
		const aiScore = computeFinalScore(similarity01, bonus);
		const feedback = generatePromptFeedback({ prompt, targetDescription, similarity01 });

		return new Response(JSON.stringify({ aiScore, similarity01, bonus, feedback }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
	}
}


