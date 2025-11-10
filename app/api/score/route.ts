import { NextRequest, NextResponse } from 'next/server';
import { computeFinalScore, embeddingSimilarity, heuristicPromptBonus, jaccardSimilarity, embeddingSimilarityForImages } from '@/lib/scoring';
import { generatePromptFeedback } from '@/lib/feedback';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const prompt = String(body?.prompt ?? '');
		const targetDescription = String(body?.targetDescription ?? '');
		const targetImage = typeof body?.targetImage === 'string' ? (body.targetImage as string) : '';
		const generatedImage = typeof body?.generatedImage === 'string' ? (body.generatedImage as string) : '';

		if (!prompt || !targetDescription) {
			return NextResponse.json({ error: 'Missing prompt or targetDescription' }, { status: 400 });
		}

		const apiKey = process.env.GOOGLE_API_KEY;
		let similarity01: number | null = null;
		let scoringMode: 'image-embedding' | 'text-embedding' | 'jaccard-fallback' | null = null;
		let errorMessage: string | null = null;
		// Prefer image embedding if both images present and key is available
		if (apiKey && targetImage && generatedImage) {
			try {
				similarity01 = await embeddingSimilarityForImages({
					targetImageDataUrl: targetImage,
					generatedImageDataUrl: generatedImage,
					apiKey,
				});
				if (similarity01 !== null) {
					scoringMode = 'image-embedding';
				}
			} catch (e: any) {
				errorMessage = e?.message ?? String(e);
				console.error('[score] Gemini image embedding error:', errorMessage);
			}
		}

		try {
			// If image similarity not available, try text embeddings as a backup
			if (similarity01 === null) {
				similarity01 = await embeddingSimilarity({
					prompt,
					targetDescription,
					apiKey: apiKey || undefined,
					useVision: true,
				});
				if (similarity01 !== null) {
					scoringMode = 'text-embedding';
				}
			}
		} catch {
			// ignore and fallback
		}

		// Fallback similarity if embeddings unavailable
		if (similarity01 === null) {
			similarity01 = jaccardSimilarity(prompt, targetDescription);
			scoringMode = 'jaccard-fallback';
		}

		const bonus = heuristicPromptBonus(prompt);
		const aiScore = computeFinalScore(similarity01, bonus);
		const feedback = generatePromptFeedback({ prompt, targetDescription, similarity01 });

		return NextResponse.json(
			{ aiScore, similarity01, bonus, feedback, scoringMode, errorMessage },
			{ status: 200 },
		);
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


