import { NextRequest, NextResponse } from 'next/server';
import { computeFinalScore, embeddingSimilarity, heuristicPromptBonus, jaccardSimilarity } from '@/lib/scoring';
import { embedImagesBase64, initTargetEmbeddings, dataUrlApproxBytes, cosineSimilarity } from '@/lib/vertex';
import { generatePromptFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';

// Warm-up target embeddings/cache on server start (non-blocking)
void initTargetEmbeddings().catch(() => {});

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

		// Server-side size validation (<= 1.5 MB each)
		if (targetImage) {
			const size = dataUrlApproxBytes(targetImage);
			if (size > 1.5 * 1024 * 1024) {
				return NextResponse.json({ error: 'Target image too large (max 1.5MB)' }, { status: 400 });
			}
		}
		if (generatedImage) {
			const size = dataUrlApproxBytes(generatedImage);
			if (size > 1.5 * 1024 * 1024) {
				return NextResponse.json({ error: 'Generated image too large (max 1.5MB)' }, { status: 400 });
			}
		}

		// Prefer image embeddings via Vertex if both images present and service account is configured
		if (targetImage && generatedImage && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.VERTEX_PROJECT_ID) {
			// === VERTEX AI SCORING ===
			let vectors: number[][] = [];
			let vertexError: string | null = null;

			try {
				console.log('[score] Calling Vertex AI with 2 images');
				vectors = await embedImagesBase64([targetImage, generatedImage]);
				console.log(`[score] Vertex returned ${vectors.length} vectors`);
			} catch (e: any) {
				vertexError = e?.message || 'Unknown Vertex error';
				console.error('[score] VERTEX FAILED:', vertexError);
			}

			// === FALLBACK IF VERTEX FAILED ===
			if (vectors.length !== 2 || vertexError) {
				console.log('[score] Falling back to Jaccard');
				const simJ = jaccardSimilarity(prompt, targetDescription);
				const bonus = heuristicPromptBonus(prompt);
				const aiScore = computeFinalScore(simJ, bonus);
				const feedback = generatePromptFeedback({ prompt, targetDescription, similarity01: simJ });
				return NextResponse.json(
					{
						aiScore,
						similarity01: simJ,
						bonus,
						feedback,
						scoringMode: 'jaccard-fallback',
						errorMessage: vertexError?.substring(0, 200) || null,
					},
					{ status: 200 },
				);
			}

			// === SUCCESS: IMAGE EMBEDDING ===
			const [v1, v2] = vectors;
			const similarity = cosineSimilarity(v1, v2);
			const similarityClamped01 = Math.max(0, Math.min(1, (similarity + 1) / 2));
			const aiScore = Math.round(similarityClamped01 * 100);
			const feedback = generatePromptFeedback({ prompt, targetDescription, similarity01: similarityClamped01 });
			return NextResponse.json(
				{
					aiScore,
					similarity01: similarityClamped01,
					bonus: 0,
					feedback,
					scoringMode: 'image-embedding',
					errorMessage: null,
				},
				{ status: 200 },
			);
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
			{
				aiScore,
				similarity01,
				bonus,
				feedback,
				scoringMode,
				errorMessage: process.env.NODE_ENV !== 'production' ? errorMessage : null,
			},
			{ status: 200 },
		);
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


