import { NextRequest, NextResponse } from 'next/server';
import { computeFinalScore, embeddingSimilarity, heuristicPromptBonus, jaccardSimilarity } from '@/lib/scoring';
import { embedImagesBase64Batch, getOrComputeImageEmbeddingCached, initTargetEmbeddings, dataUrlApproxBytes, cosineSimilarity } from '@/lib/vertex';
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
			try {
				// Try to use cached/precomputed target vector. If not cached, do a single batched call and cache target.
				let vTarget: number[] | null = null;
				let vGen: number[] | null = null;
				try {
					vTarget = await getOrComputeImageEmbeddingCached(targetImage);
				} catch {
					// Not cached yet: we will fall back to batched predict below
				}
				if (vTarget) {
					[vGen] = await embedImagesBase64Batch([generatedImage]);
				} else {
					const [vt, vg] = await embedImagesBase64Batch([targetImage, generatedImage]);
					vTarget = vt;
					vGen = vg;
					// Cache the target
					// getOrComputeImageEmbeddingCached will compute and store; we already have it, so store directly
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const { getOrComputeImageEmbeddingCached: _ } = await import('@/lib/vertex'); // no-op import to ensure module initialized
					// Manually seed cache by calling once (it will hit cache store via compute path)
					// Avoid duplicate network call by setting directly through internal function is not exposed; acceptable to skip
				}
				if (vTarget && vGen) {
					const sim = cosineSimilarity(vTarget, vGen);
					similarity01 = Math.max(0, Math.min(1, sim));
					scoringMode = 'image-embedding';
				}
			} catch (e: any) {
				const vertexError = e?.message ?? String(e);
				console.error('[score] Vertex image embedding error:', vertexError);
				// Immediate fallback with visible error message (truncated) to aid diagnosis
				const similarity01Fallback = jaccardSimilarity(prompt, targetDescription);
				const bonusFallback = heuristicPromptBonus(prompt);
				const aiScoreFallback = computeFinalScore(similarity01Fallback, bonusFallback);
				const feedbackFallback = generatePromptFeedback({ prompt, targetDescription, similarity01: similarity01Fallback });
				return NextResponse.json(
					{
						aiScore: aiScoreFallback,
						similarity01: similarity01Fallback,
						bonus: bonusFallback,
						feedback: feedbackFallback,
						scoringMode: 'jaccard-fallback',
						errorMessage: vertexError.slice(0, 200),
					},
					{ status: 200 },
				);
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


