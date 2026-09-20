# TECH_STACK — Tripwire

Every version below was checked against current sources as of **17 September 2026**, not recalled from training data. Do not silently substitute a different major version — if a package here is unavailable when you actually run install, stop and re-check rather than guessing a replacement.

This document deliberately **overrides** the generic "Next.js + Supabase" default stack, because the PRD (Section 3.2) explicitly rules out a database for this build — there is nothing to persist across a session, so adding Supabase would be pure overhead with no corresponding requirement.

---

## Frontend

| Package | Version | Why |
|---|---|---|
| `next` | **16.3.5** (Active LTS, released 11 Sep 2026) | Latest stable. Verify at install time — Next.js ships security patches frequently; if a newer 16.x patch exists, take it. Do not use 15.x. |
| `react` / `react-dom` | **19.2.6** | Matches the React version Next.js 16.3.x ships against; also the version patched in the May 2026 coordinated security release — do not pin below this. |
| `typescript` | **5.7.x** (latest 5.7 patch at install time) | Standard for a Next.js 16 App Router project. |
| `tailwindcss` | **v4.x** (latest at install time) | Used via the CSS-first `@import "tailwindcss"` config, not the old `tailwind.config.js` JS setup — v4 changed this; do not follow v3-era tutorials. |

## Retrieval — the sponsor requirement

| Package | Version | Notes |
|---|---|---|
| `@moss-dev/moss` | latest (npm) | **Server-side** Node.js runtime (Node 20+ required). This is what runs in the Next.js API routes for indexing and the fast-path query (FR-7). |

**Real API shape (verified against `usemoss/moss` on GitHub, not assumed):**

```ts
import { MossClient } from "@moss-dev/moss";

const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!);

// One-time per session, after chunking (FR-2):
await client.createIndex(sessionIndexName, chunks.map(c => ({ id: c.chunkId, text: c.text })));
await client.loadIndex(sessionIndexName);

// Per-sentence, fast path (FR-7):
const results = await client.query(sessionIndexName, sentenceText, { topK: 3 });
// results.docs: [{ id, text, score }, ...]
// results.timeTakenInMs: the number you show in the UI (FR-9) — this is real, not simulated
```

Sign up at **moss.dev** for a `project_id` / `project_key` (free tier: 1 project, 3 indexes, 1,000 items per index — comfortably enough for one 20-page document's chunks). Do this on Day 1, first task, since every other step depends on it.

**Important scoping note:** Moss's built-in embedding model handles the "semantic similarity" half of retrieval automatically — it does **not** by itself solve the similarity-is-not-truth problem (PRD Section 5). That's why FR-8's separate verdict-classification LLM call exists downstream of the Moss query. Do not treat a high Moss `score` as a verdict.

## A/B Baseline (FR-12)

No package — build it yourself, on purpose. A brute-force cosine-similarity scan over the same chunks, computed in plain TypeScript:

1. Embed each chunk once at indexing time using any embedding endpoint you already have access to (OpenAI's embeddings endpoint or an equivalent is fine — this is a one-time cost per document, not per sentence).
2. On each baseline query: embed the sentence, compute cosine similarity against every stored chunk vector in a plain loop, sort, take top-3.
3. Time it with `performance.now()` around the actual loop — this real, measured number is what makes the toggle honest (see PRD Section 15, "A/B baseline gap doesn't show up live" risk).

Do not use a hosted vector DB (Pinecone, Qdrant, etc.) for the baseline — that adds a dependency and setup risk for zero benefit; a slow *local* scan demonstrates the same point with less to configure. Moss's own published benchmarks (Macbook Pro M4 Pro, 100K docs, top_k=5) show Moss at ~3.1ms mean vs. ChromaDB at ~358ms and Pinecone at ~486ms — your baseline doesn't need to be exotic to be genuinely, honestly slower.

## LLM — generation, verdict, and explanation calls

Three call *shapes* (PRD Section 8, FR-4/FR-8/FR-10). **Primary provider for the hackathon build: Google Gemini API**, chosen for its free tier — no billing setup needed before demo day.

| Model | Use for | Note (verified 17 Sep 2026) |
|---|---|---|
| **Gemini 3 Flash** (or the newest GA Flash model at build time — `gemini-3.8-flash` is current as of this writing) | Generation call (FR-4) | Supports streaming natively via the Gen AI SDK / REST `streamGenerateContent`. Free tier is Flash/Flash-Lite only — **Gemini Pro models were removed from the free tier in April 2026**, so don't reach for a Pro model expecting it to still be free. |
| **Gemini Flash-Lite** (e.g. `gemini-3.1-flash-lite`) | Verdict + explanation calls (FR-8/FR-10) | Flash-Lite variants consistently carry a *higher* free-tier RPM than standard Flash across every source we checked, which is exactly the axis that matters for a call firing once per sentence — use Flash-Lite here even if Flash is used for generation. |

**Free-tier numbers to plan around (these move — Google adjusts them without much notice, and multiple independent trackers disagree by a few RPM/RPD depending on exactly which model and which week; treat the figures below as "the right order of magnitude to plan a demo around," and pull the live number from `https://aistudio.google.com/rate-limit` the morning of any rehearsal or the demo itself):**

- Roughly **10–15 requests/minute** and **~500–1,500 requests/day** depending on the specific Flash/Flash-Lite model.
- All current free-tier text models share a **250,000 tokens/minute** budget.
- RPD resets at **midnight Pacific time**, not on a rolling 24-hour window — if you burn the day's quota during an afternoon rehearsal, it does not come back that evening.
- Rate limits are per **project**, not per API key — creating a second key on the same project does not help.

**Why this is still a real risk even with Gemini's more generous daily cap than some alternatives:** a fast-streaming answer with ~8–10 checkable sentences fires up to ~20 verdict+explanation calls in well under a minute during a live demo. At 10–15 RPM, that alone can approach the per-minute ceiling on a single answer, even before a second question is asked. This is the same rate-limit risk named in `docs/PRD.md` Section 15 — the mitigation (bounded concurrency + backoff, default to AMBER on exhausted retries) applies regardless of which provider sits behind it.

### Fallback plan for the Bangalore finals round (not required for the initial 3-day submission)

If selected, add a second provider behind the same OpenAI-compatible call shape so a rate-limit hit during the live judged demo degrades gracefully instead of stalling the queue. Two reasonable options, both checked as of 17 Sep 2026:

- **OpenRouter** — free `:free`-suffixed models at **20 requests/minute**, **50 requests/day** (rising to **1,000/day** after any lifetime $10 credit purchase — the purchase is one-time and credits don't expire). Good breadth (dozens of free models behind one key) but a *lower* RPM ceiling than Gemini's, so it's better suited as a secondary fallback than a primary swap.
- **Nvidia NIM** (`build.nvidia.com`) — free tier is roughly **40 requests/minute per key**, shared across whichever model(s) you call, with **no published daily cap** at the time of writing (unlike Gemini and OpenRouter, which both cap RPD). That absence of a daily ceiling makes it a strong candidate specifically for the verdict/explanation path, where per-minute burst matters more than daily volume.

Implementation note for whichever you pick: because all three (Gemini via its OpenAI-compatibility layer, OpenRouter, and NIM) expose an OpenAI-compatible `chat.completions`-style endpoint, wrap the verdict/explanation call behind a single internal function that takes a `provider` argument and swaps `baseURL`/`apiKey` — this is a config change, not a rewrite, if you add a fallback later. Don't build this multi-provider fallback for the first submission; the PRD's priority order (Section 16) says FR-1 through FR-9 first, and provider redundancy is a finals-round nice-to-have, not a build blocker now.

## Backend

- **Next.js API routes** only. No separate backend service.
- Three routes: `/api/session` (document intake + chunking + Moss indexing, FR-1/FR-2), `/api/generate` (streaming generation, FR-4), `/api/verify` (retrieval + verdict + explanation for one sentence, FR-7/FR-8/FR-10).
- **No database.** Session state lives in React state on the client (PRD Section 10.3) for the duration of one browser session. This is a deliberate, PRD-locked decision — do not add Postgres/Supabase/Redis "just in case."
- **No authentication.** Nothing to protect; nothing persists.

## Deployment

- **Vercel**, single project, single deployment. No separate services to stand up.
- Environment variables (`.env.example` at repo root) set in the Vercel project dashboard before the first deploy, not after — a missing key on first deploy wastes a rehearsal cycle.

## Explicitly not used, and why

| Not used | Why |
|---|---|
| Supabase / any database | Nothing to persist (PRD Section 3.2) |
| Auth (NextAuth, Clerk, etc.) | No accounts, no protected resources |
| A hosted vector DB for the baseline | Would undercut the honesty of the A/B toggle for no benefit |
| A self-hosted NLI model | Deliberately traded for a small/cheap LLM call to minimize infra load (locked decision, PRD conversation history) |
| LiveKit / WebRTC / any voice stack | Tripwire is text-in, text-out — no audio component in this product at all |
