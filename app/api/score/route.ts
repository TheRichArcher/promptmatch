import { NextRequest, NextResponse } from 'next/server';
import { computeFinalScore, heuristicPromptBonus, jaccardSimilarity } from '@/lib/scoring';
import { embedImagesBase64, initTargetEmbeddings, dataUrlApproxBytes, cosineSimilarity } from '@/lib/vertex';
import { generateFeedback } from '@/lib/feedbackEngine';
import { unsealGoldPrompt } from '@/lib/secureText';
import type { Tier } from '@/lib/tiers';

export const runtime = 'nodejs';

// Warm-up target embeddings/cache on server start (non-blocking)
void initTargetEmbeddings().catch(() => {});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const prompt = String(body?.prompt ?? '');
		let targetDescription = String(body?.targetDescription ?? '');
		const targetToken = typeof body?.targetToken === 'string' ? (body.targetToken as string) : '';
		const targetImage = typeof body?.targetImage === 'string' ? (body.targetImage as string) : '';
		const generatedImage = typeof body?.generatedImage === 'string' ? (body.generatedImage as string) : '';
		const tier: Tier | undefined = (body?.tier as Tier) || undefined;

		if (!prompt || (!targetDescription && !targetToken)) {
			return NextResponse.json({ error: 'Missing prompt or target reference' }, { status: 400 });
		}
		// Prefer server-side unsealing if token provided
		if (!targetDescription && targetToken) {
			try {
				targetDescription = unsealGoldPrompt(targetToken);
			} catch {
				return NextResponse.json({ error: 'Invalid target token' }, { status: 400 });
			}
		}

		const apiKey = process.env.GOOGLE_API_KEY;
		let similarity01: number | null = null;
		let scoringMode: 'image-embedding' | 'jaccard-fallback' | null = null;
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

		// Prefer image embeddings via Vertex if both images present (FORCE ENABLED)
		if (targetImage && generatedImage) {
			// === VERTEX AI SCORING (FORCE ENABLED) ===
			let vectors: number[][] = [];
			let vertexError: string | null = null;

			try {
				vectors = await embedImagesBase64([targetImage, generatedImage]);
			} catch (e: any) {
				vertexError = e?.message || 'Vertex failed';
			}

			// === FORCE IMAGE-EMBEDDING MODE (NO FALLBACK) ===
			if (vectors.length === 2 && vectors[0].length > 0) {
				const [v1, v2] = vectors;
				const similarity = cosineSimilarity(v1, v2);
				const similarity01 = Math.max(0, Math.min(1, (similarity + 1) / 2));
				let aiScore = Math.round(similarity01 * 100);
				// Tier-aware EASY boost
				if (tier === 'easy') {
					const words = String(prompt || '').trim().split(/\s+/).filter(Boolean).length;
					if (words > 0 && words <= 3) aiScore = Math.min(100, aiScore + 15);
					if (String(prompt || '').toLowerCase().includes('triangle') && String(targetDescription || '').toLowerCase().includes('triangle')) {
						aiScore = Math.max(aiScore, 95);
					}
				}
				const feedback = generateFeedback(targetDescription, prompt, aiScore, { tier });
				return NextResponse.json(
					{
						aiScore,
						similarity01,
						bonus: 0,
						feedback,
						scoringMode: 'image-embedding',
						errorMessage: null,
					},
					{ status: 200 },
				);
			}

			// === ONLY FALLBACK IF VERTEX TRULY FAILED ===
			const simJ = jaccardSimilarity(prompt, targetDescription);
			const bonus = heuristicPromptBonus(prompt);
			let aiScore = computeFinalScore(simJ, bonus);
			// Tier-aware EASY boost
			if (tier === 'easy') {
				const words = String(prompt || '').trim().split(/\s+/).filter(Boolean).length;
				if (words > 0 && words <= 3) aiScore = Math.min(100, aiScore + 15);
				if (String(prompt || '').toLowerCase().includes('triangle') && String(targetDescription || '').toLowerCase().includes('triangle')) {
					aiScore = Math.max(aiScore, 95);
				}
			}
			const feedback = generateFeedback(targetDescription, prompt, aiScore, { tier });
			return NextResponse.json(
				{
					aiScore,
					similarity01: simJ,
					bonus,
					feedback,
					scoringMode: process.env.NODE_ENV !== 'production' ? 'jaccard-fallback' : undefined,
					errorMessage: process.env.NODE_ENV !== 'production' ? vertexError?.substring(0, 200) || null : null,
				},
				{ status: 200 },
			);
		}

		// Fallback similarity if embeddings unavailable
		if (similarity01 === null) {
			similarity01 = jaccardSimilarity(prompt, targetDescription);
			scoringMode = 'jaccard-fallback';
		}

		const bonus = heuristicPromptBonus(prompt);
		let aiScore = computeFinalScore(similarity01, bonus);
		// Tier-aware EASY boost
		if (tier === 'easy') {
			const words = String(prompt || '').trim().split(/\s+/).filter(Boolean).length;
			if (words > 0 && words <= 3) aiScore = Math.min(100, aiScore + 15);
			if (String(prompt || '').toLowerCase().includes('triangle') && String(targetDescription || '').toLowerCase().includes('triangle')) {
				aiScore = Math.max(aiScore, 95);
			}
		}
		const feedback = generateFeedback(targetDescription, prompt, aiScore, { tier });

		return NextResponse.json(
			{
				aiScore,
				similarity01,
				bonus,
				feedback,
				scoringMode: scoringMode === 'jaccard-fallback' && process.env.NODE_ENV === 'production' ? undefined : scoringMode,
				errorMessage: process.env.NODE_ENV !== 'production' ? errorMessage : null,
			},
			{ status: 200 },
		);
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


