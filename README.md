# PromptMatch (Prototype)

Train your AI prompting skills by recreating a hidden image as accurately as possible. The closer your generated image is to the original, the higher your score.

This prototype includes:
- Next.js + Tailwind front-end
- Training mode with simple shape levels
- Scoring API using Gemini embeddings (if configured) with a prompt-only fallback
- Coaching feedback tips after each attempt

## Quick Start

1) Install dependencies:
```bash
pnpm install || yarn || npm install
```

2) (Optional but recommended) Configure Gemini API key for embeddings:
- Create a `.env.local` at the project root and add:
```
GOOGLE_API_KEY=your_google_ai_studio_key_here
NEXT_PUBLIC_APP_NAME=PromptMatch
```
- Without a key, scoring will fall back to a prompt-text similarity so you can still train offline.

3) Run the dev server:
```bash
pnpm dev || yarn dev || npm run dev
```

Open http://localhost:3000. Click “Start Training”.

## How Scoring Works (Prototype)

- If `GOOGLE_API_KEY` is set, the server calls the embeddings endpoint (prefers `multimodalembedding`, falls back to `text-embedding-004`) to score semantic similarity between your prompt and the target description.
- A small heuristic bonus is added for useful prompt structure (composition, lighting, perspective, size, background mentions).
- If the key is not set, a prompt-only fallback (token overlap/Jaccard) is used.

Final score: similarity [0..1] → 0..100 plus bonus (capped).

## Image Generation

The `/api/generate` route is a safe stub. Wire it to Gemini 2.5 Flash Image (Nano Banana) when available in your environment, then return a base64/image data URL to show the actual generation result in the UI.

## Project Structure

- `app/` — Next.js App Router pages and API routes
  - `app/play/page.tsx` — Training mode UI
  - `app/api/score/route.ts` — Scoring (embeddings + fallback)
  - `app/api/generate/route.ts` — Image generation stub (replace with Gemini call)
- `components/` — UI components (CanvasPreview, PromptInput, ScoreCard)
- `lib/levels.ts` — Simple shape training levels
- `lib/scoring.ts` — Similarity and bonus logic
- `lib/feedback.ts` — Coaching tips

## Next Steps

- Replace the generate stub with Gemini 2.5 Flash Image API call
- Add Daily Challenge with server timestamp/seed and simple leaderboard
- Store game rounds, prompts, and ratings (Supabase/Firebase)
- Crowd scoring and replay (“Beat This Prompt”)
- SSIM for beginner levels (client-side canvas or server-side)

## License

MIT — for the prototype scaffolding code. Make sure your usage of Gemini and any datasets complies with their terms.


