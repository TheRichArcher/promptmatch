import { NextRequest, NextResponse } from 'next/server';
import { computeFinalScore, computeDailyExpertScore, heuristicPromptBonus, jaccardSimilarity } from '@/lib/scoring';
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
		const targetMeta = (body?.targetMeta && typeof body.targetMeta === 'object')
			? (body.targetMeta as { label?: string; tier?: Tier; goldPrompt?: string })
			: undefined;
		const targetObj = (body?.target && typeof body.target === 'object')
			? (body.target as { label?: string; url?: string; tier?: Tier })
			: undefined;
		const targetToken = typeof body?.targetToken === 'string' ? (body.targetToken as string) : '';
		const targetImage = typeof body?.targetImage === 'string' ? (body.targetImage as string) : '';
		const generatedImage = typeof body?.generatedImage === 'string' ? (body.generatedImage as string) : '';
		const tier: Tier | undefined = (body?.tier as Tier) || undefined;
		// Check if this is a daily challenge (via header or body flag)
		const isDailyChallenge = req.headers.get('x-daily-challenge') === 'true' 
			|| body?.isDailyChallenge === true
			|| (targetMeta?.label && targetMeta.label.includes('Daily Challenge'));

		// Validate presence of target reference (either token/description, explicit target payload, or both images for daily mode)
		if (!prompt || (!targetDescription && !targetToken && !targetObj && !(targetImage && generatedImage))) {
			return NextResponse.json({ error: 'Missing prompt or target reference' }, { status: 400 });
		}
		// If explicit target payload provided, ensure it contains required metadata
		if (targetObj) {
			if (!targetObj.label || !targetObj.url) {
				return NextResponse.json({ error: 'Missing target data' }, { status: 400 });
			}
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

		// Build target metadata to pass to feedback engine
		const feedbackTarget = (() => {
			if (targetObj?.label) {
				return {
					label: String(targetObj.label),
					url: String(targetObj.url || ''),
					tier: (targetObj.tier ?? tier) as Tier | undefined,
					goldPrompt: String(targetDescription || ''),
				};
			}
			if (targetMeta?.label) {
				return {
					label: String(targetMeta.label),
					url: String(targetImage || ''),
					tier: (targetMeta.tier ?? tier) as Tier | undefined,
					goldPrompt: String(targetMeta?.goldPrompt || targetDescription || ''),
				};
			}
			return {
				label: String(targetDescription || ''),
				url: String(targetImage || ''),
				tier: tier as Tier | undefined,
				goldPrompt: String(targetDescription || ''),
			};
		})();

		// Server-side size validation (<= 1.5 MB each)
		// Skip size validation for daily challenges - they use high-res pre-validated images
		if (!isDailyChallenge) {
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
		}

		// Prefer image embeddings via Vertex if both images present (FORCE ENABLED)
		if (targetImage && generatedImage) {
			// === VERTEX AI SCORING (FORCE ENABLED) ===
			let vectors: number[][] = [];
			let vertexError: string | null = null;

			try {
				// eslint-disable-next-line no-console
				console.log('[score] Daily mode: both images present, computing embeddings...');
				vectors = await embedImagesBase64([targetImage, generatedImage]);
				// eslint-disable-next-line no-console
				console.log('[score] Embeddings computed:', vectors.length, 'vectors');
			} catch (e: any) {
				vertexError = e?.message || 'Vertex failed';
				// eslint-disable-next-line no-console
				console.error('[score] Vertex embedding error:', vertexError);
			}

			// === FORCE IMAGE-EMBEDDING MODE (NO FALLBACK) ===
			if (vectors.length === 2 && vectors[0].length > 0) {
				const [v1, v2] = vectors;
				const similarity = cosineSimilarity(v1, v2);
				const similarity01 = Math.max(0, Math.min(1, (similarity + 1) / 2));
				let aiScore = Math.round(similarity01 * 100);
				// eslint-disable-next-line no-console
				console.log('[score] Image similarity:', similarity01, '→ score:', aiScore);
				
				// Medium/Hard/Advanced/Expert/Daily tier: use balanced scoring
				const currentTier = targetMeta?.tier ?? tier;
				if (isDailyChallenge || currentTier === 'medium' || currentTier === 'hard' || currentTier === 'advanced' || currentTier === 'expert') {
					const targetDesc = targetMeta?.goldPrompt || targetDescription || targetMeta?.label || '';
					aiScore = computeDailyExpertScore(similarity01, prompt, targetDesc);
				}
				// Easy tier: rely on model similarity; apply only small optional boosts and capped penalty. No handcrafted strict rules.
				else if (targetMeta?.tier === 'easy') {
					const lowerPrompt = String(prompt || '').toLowerCase();
					const lowerLabel = String(targetMeta?.label || '').toLowerCase();
					// Color detection
					const COLORS = ['red','blue','green','yellow','orange','pink','black','white','purple','brown','gray','grey','cyan','magenta'];
					const labelColor = COLORS.find((c) => lowerLabel.includes(c));
					const colorMatched = Boolean(labelColor && lowerPrompt.includes(labelColor));
					// General object noun (shape) detection with broad synonyms
					const SHAPE_MAP: Record<string, string[]> = {
						circle: ['circle','dot','disc','disk'],
						square: ['square','box'],
						triangle: ['triangle'],
						star: ['star'],
						heart: ['heart'],
						oval: ['oval','ellipse'],
						diamond: ['diamond','rhombus'],
						hexagon: ['hexagon','hex'],
						rectangle: ['rectangle','rect','oblong'],
					};
					const allShapeTokens = Object.values(SHAPE_MAP).flat();
					const canonicalOf = (word: string): string | null => {
						for (const [canon, list] of Object.entries(SHAPE_MAP)) {
							if (list.includes(word)) return canon;
						}
						return null;
					};
					const labelShape = lowerLabel
						.split(/\s+/)
						.map(canonicalOf)
						.find((v) => v) || null;
					const promptShapeToken = lowerPrompt
						.split(/\s+/)
						.find((w) => allShapeTokens.includes(w));
					const promptShape = promptShapeToken ? canonicalOf(promptShapeToken) : null;
					const objectMatched = Boolean(labelShape && promptShape && labelShape === promptShape);
					// Small boosts
					let boost = 0;
					if (colorMatched) boost += 3;
					if (objectMatched) boost += 5;
					// Capped penalty for missing object detail (only if similarity is not already very high)
					let penalty = 0;
					if (!objectMatched && similarity01 < 0.8) {
						penalty = Math.min(10, Math.max(0, Math.round((0.8 - similarity01) * 50)));
					}
					aiScore = Math.max(0, Math.min(100, Math.round(similarity01 * 100 + boost - penalty)));
				}
				const feedback = generateFeedback(prompt, feedbackTarget);
				try {
					// eslint-disable-next-line no-console
					console.log('FEEDBACK TARGET:', feedbackTarget.label);
					// eslint-disable-next-line no-console
					console.log('FEEDBACK OUTPUT:', feedback.note);
				} catch {}
				// Calculate bonus for response (sum of all bonuses applied)
				let responseBonus = 0;
				if (isDailyChallenge || currentTier === 'medium' || currentTier === 'hard' || currentTier === 'advanced' || currentTier === 'expert') {
					const hasTexture = /shiny|fuzzy|matte|glossy|rough|smooth|metal|glass/i.test(prompt);
					const hasLight = /shadow|light|glowing|backlit|warm|cool|volumetric|cinematic/i.test(prompt);
					if (hasTexture) responseBonus += 8;
					if (hasLight) responseBonus += 7;
					if (prompt.includes('--no')) responseBonus += 6;
					if (prompt.includes('--ar')) responseBonus += 4;
					if (/masterpiece|ultra-detailed|highly detailed/i.test(prompt)) responseBonus += 5;
				}
				return NextResponse.json(
					{
						aiScore,
						similarity01,
						bonus: responseBonus,
						feedback,
						suggestion: feedback?.note || null,
						scoringMode: 'image-embedding',
						errorMessage: null,
					},
					{ status: 200 },
				);
			}

			// === ONLY FALLBACK IF VERTEX TRULY FAILED ===
			// Use targetMeta label/goldPrompt as fallback description for daily challenges
			const fallbackDescription = targetDescription || targetMeta?.goldPrompt || targetMeta?.label || '';
			const simJ = jaccardSimilarity(prompt, fallbackDescription);
			let aiScore: number;
			const currentTier = targetMeta?.tier ?? tier;
			// Medium/Hard/Advanced/Expert/Daily tier: use balanced scoring
			if (isDailyChallenge || currentTier === 'medium' || currentTier === 'hard' || currentTier === 'advanced' || currentTier === 'expert') {
				aiScore = computeDailyExpertScore(simJ, prompt, fallbackDescription);
			}
			else if (targetMeta?.tier === 'easy') {
				// Easy tier: no handcrafted keyword bonuses; small optional boosts; capped penalty
				const similarity01Easy = simJ; // fallback similarity
				const lowerPrompt = String(prompt || '').toLowerCase();
				const lowerLabel = String(targetMeta?.label || '').toLowerCase();
				const COLORS = ['red','blue','green','yellow','orange','pink','black','white','purple','brown','gray','grey','cyan','magenta'];
				const labelColor = COLORS.find((c) => lowerLabel.includes(c));
				const colorMatched = Boolean(labelColor && lowerPrompt.includes(labelColor));
				const SHAPE_MAP: Record<string, string[]> = {
					circle: ['circle','dot','disc','disk'],
					square: ['square','box'],
					triangle: ['triangle'],
					star: ['star'],
					heart: ['heart'],
					oval: ['oval','ellipse'],
					diamond: ['diamond','rhombus'],
					hexagon: ['hexagon','hex'],
					rectangle: ['rectangle','rect','oblong'],
				};
				const allShapeTokens = Object.values(SHAPE_MAP).flat();
				const canonicalOf = (word: string): string | null => {
					for (const [canon, list] of Object.entries(SHAPE_MAP)) {
						if (list.includes(word)) return canon;
					}
					return null;
				};
				const labelShape = lowerLabel
					.split(/\s+/)
					.map(canonicalOf)
					.find((v) => v) || null;
				const promptShapeToken = lowerPrompt
					.split(/\s+/)
					.find((w) => allShapeTokens.includes(w));
				const promptShape = promptShapeToken ? canonicalOf(promptShapeToken) : null;
				const objectMatched = Boolean(labelShape && promptShape && labelShape === promptShape);
				let boost = 0;
				if (colorMatched) boost += 3;
				if (objectMatched) boost += 5;
				let penalty = 0;
				if (!objectMatched && similarity01Easy < 0.8) {
					penalty = Math.min(10, Math.max(0, Math.round((0.8 - similarity01Easy) * 50)));
				}
				aiScore = Math.max(0, Math.min(100, Math.round(similarity01Easy * 100 + boost - penalty)));
			} else {
				// Non-easy tiers keep heuristic bonuses
				const bonus = heuristicPromptBonus(prompt);
				aiScore = computeFinalScore(simJ, bonus);
			}
			const feedback = generateFeedback(prompt, feedbackTarget);
			try {
				// eslint-disable-next-line no-console
				console.log('FEEDBACK TARGET:', feedbackTarget.label);
				// eslint-disable-next-line no-console
				console.log('FEEDBACK OUTPUT:', feedback.note);
			} catch {}
			// Calculate bonus for response
			let responseBonus = 0;
			if (isDailyChallenge || currentTier === 'medium' || currentTier === 'hard' || currentTier === 'advanced' || currentTier === 'expert') {
				const hasTexture = /shiny|fuzzy|matte|glossy|rough|smooth|metal|glass/i.test(prompt);
				const hasLight = /shadow|light|glowing|backlit|warm|cool|volumetric|cinematic/i.test(prompt);
				if (hasTexture) responseBonus += 8;
				if (hasLight) responseBonus += 7;
				if (prompt.includes('--no')) responseBonus += 6;
				if (prompt.includes('--ar')) responseBonus += 4;
				if (/masterpiece|ultra-detailed|highly detailed/i.test(prompt)) responseBonus += 5;
			} else if (targetMeta?.tier === 'easy') {
				responseBonus = 0;
			} else {
				responseBonus = heuristicPromptBonus(prompt);
			}
			return NextResponse.json(
				{
					aiScore,
					similarity01: simJ,
					bonus: responseBonus,
					feedback,
					suggestion: feedback?.note || null,
					scoringMode: process.env.NODE_ENV !== 'production' ? 'jaccard-fallback' : undefined,
					errorMessage: process.env.NODE_ENV !== 'production' ? vertexError?.substring(0, 200) || null : null,
				},
				{ status: 200 },
			);
		}

		// Fallback similarity if embeddings unavailable
		const fallbackDescription = targetDescription || targetMeta?.goldPrompt || targetMeta?.label || '';
		if (similarity01 === null) {
			// Use targetMeta label/goldPrompt as fallback description for daily challenges
			similarity01 = jaccardSimilarity(prompt, fallbackDescription);
			scoringMode = 'jaccard-fallback';
		}

		let aiScore: number;
		const currentTier = targetMeta?.tier ?? tier;
		// Medium/Hard/Advanced/Expert/Daily tier: use balanced scoring
		if (isDailyChallenge || currentTier === 'medium' || currentTier === 'hard' || currentTier === 'advanced' || currentTier === 'expert') {
			aiScore = computeDailyExpertScore(similarity01, prompt, fallbackDescription);
		}
		else if (targetMeta?.tier === 'easy') {
			// Easy tier: rely on similarity; small optional boosts; capped penalty; no heuristic bonus
			const lowerPrompt = String(prompt || '').toLowerCase();
			const lowerLabel = String(
				targetMeta?.label || targetDescription || '',
			).toLowerCase();
			const COLORS = ['red','blue','green','yellow','orange','pink','black','white','purple','brown','gray','grey','cyan','magenta'];
			const labelColor = COLORS.find((c) => lowerLabel.includes(c));
			const colorMatched = Boolean(labelColor && lowerPrompt.includes(labelColor));
			const SHAPE_MAP: Record<string, string[]> = {
				circle: ['circle','dot','disc','disk'],
				square: ['square','box'],
				triangle: ['triangle'],
				star: ['star'],
				heart: ['heart'],
				oval: ['oval','ellipse'],
				diamond: ['diamond','rhombus'],
				hexagon: ['hexagon','hex'],
				rectangle: ['rectangle','rect','oblong'],
			};
			const allShapeTokens = Object.values(SHAPE_MAP).flat();
			const canonicalOf = (word: string): string | null => {
				for (const [canon, list] of Object.entries(SHAPE_MAP)) {
					if (list.includes(word)) return canon;
				}
				return null;
			};
			const labelShape = lowerLabel
				.split(/\s+/)
				.map(canonicalOf)
				.find((v) => v) || null;
			const promptShapeToken = lowerPrompt
				.split(/\s+/)
				.find((w) => allShapeTokens.includes(w));
			const promptShape = promptShapeToken ? canonicalOf(promptShapeToken) : null;
			const objectMatched = Boolean(labelShape && promptShape && labelShape === promptShape);
			let boost = 0;
			if (colorMatched) boost += 3;
			if (objectMatched) boost += 5;
			let penalty = 0;
			if (!objectMatched && similarity01 < 0.8) {
				penalty = Math.min(10, Math.max(0, Math.round((0.8 - similarity01) * 50)));
			}
			aiScore = Math.max(0, Math.min(100, Math.round(similarity01 * 100 + boost - penalty)));
		} else {
			const bonus = heuristicPromptBonus(prompt);
			aiScore = computeFinalScore(similarity01, bonus);
		}
		const feedback = generateFeedback(prompt, feedbackTarget);
		try {
			// eslint-disable-next-line no-console
			console.log('FEEDBACK TARGET:', feedbackTarget.label);
			// eslint-disable-next-line no-console
			console.log('FEEDBACK OUTPUT:', feedback.note);
		} catch {}

		// Calculate bonus for response
		const responseBonus = (isDailyChallenge || currentTier === 'expert')
			? ((prompt.includes('--no') || prompt.includes('--ar')) ? 8 : 0)
			: (targetMeta?.tier === 'easy' ? 0 : heuristicPromptBonus(prompt));

		return NextResponse.json(
			{
				aiScore,
				similarity01,
				bonus: responseBonus,
				feedback,
				suggestion: feedback?.note || null,
				scoringMode: scoringMode === 'jaccard-fallback' && process.env.NODE_ENV === 'production' ? undefined : scoringMode,
				errorMessage: process.env.NODE_ENV !== 'production' ? errorMessage : null,
			},
			{ status: 200 },
		);
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
	}
}


