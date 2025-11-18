# PromptMatch - Quick Summary

## What It Is
An interactive web app that trains users to write better AI image prompts by scoring their descriptions against target images.

## Tech Stack
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI:** Google Gemini 2.5 Flash Image, Vertex AI Multimodal Embeddings
- **Deployment:** Render.com (Node.js)

## Core Features
✅ **5-Tier Progressive Curriculum** (Easy → Expert)  
✅ **Real-time Image Generation** from user prompts  
✅ **AI-Powered Scoring** using image embeddings  
✅ **Personalized Feedback** with tier-specific tips  
✅ **Progress Tracking** with session history  
✅ **Tutorial System** for new users  
✅ **Level Briefing Overlays** for each tier  

## Key Systems

### Scoring
- **Primary:** Vertex AI image embeddings → cosine similarity
- **Fallback:** Jaccard text similarity + heuristic bonuses
- **Tier Adjustments:** Color/shape matching (Easy), texture/lighting bonuses (Medium+)

### Image Generation
- Gemini 2.5 Flash Image API
- Tier-aware prompt modification
- Deterministic SVG placeholders (no API key)

### Training Flow
1. Initialize 5 target images (Easy: SVG shapes, Others: local pools or auto-gen)
2. User writes prompt → Generate image → Score → Feedback
3. Repeat 5 rounds → Summary → Unlock next tier

### Security
- AES-256-GCM encryption for gold prompts
- Server-side only decryption
- No client-side prompt extraction

## File Structure
```
app/          # Next.js pages & API routes
components/   # React UI components (9 major)
lib/          # Core logic (scoring, feedback, tiers, etc.)
public/       # Static assets (images, tutorial files)
```

## API Endpoints
- `POST /api/generate` - Generate image from prompt
- `POST /api/score` - Score prompt against target
- `POST /api/train/init` - Initialize training session
- `POST /api/train/summary` - Reveal gold prompts
- `GET /api/health` - Health check

## Curriculum Tiers

| Tier | Focus | Goal | Example |
|------|-------|------|---------|
| **Easy** | Color + Shape | 95+ | "red circle" |
| **Medium** | Texture + Light | 90+ | "shiny red apple, soft shadows" |
| **Hard** | Scene + Environment | 85+ | "apple on wooden counter, kitchen" |
| **Advanced** | Style + Camera | 80+ | "close-up, 35mm film, cinematic" |
| **Expert** | Precision Controls | 75+ | "--no blur, --ar 16:9, masterpiece" |

## Data Storage
- **Client:** localStorage (progress, level state)
- **Server:** In-memory caches (embeddings, tokens, used images)

## Setup
1. `pnpm install`
2. Create `.env.local` with `GOOGLE_API_KEY`
3. `pnpm dev` → http://localhost:3000

## Status
✅ **Production Ready** - All core features complete  
⏳ **Future:** Daily challenges, social features, server persistence

---

**Full Report:** See `PROJECT_REPORT.md` for comprehensive details.

