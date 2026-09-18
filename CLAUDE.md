# CLAUDE.md — Tripwire

Instructions for any AI agent (Claude Code, Antigravity, or otherwise) working in this repo. Read this before writing or modifying any code.

## What this project is

A Next.js app that fact-checks an LLM's streaming answer against an uploaded document, sentence by sentence, using Moss for sub-10ms retrieval. Full spec: `docs/PRD.md` (locked, v1.1 — treat as the source of truth for requirements; if a chat instruction conflicts with it, flag the conflict rather than silently picking one).

## Read before writing any pipeline code

`skills/tripwire-pipeline/SKILL.md` — the five invariants that, if violated, produce a working-looking app that is actually broken in a way that's hard to notice by testing casually (e.g., it will pass a "does it show colors" smoke test while showing the *wrong* colors). This is not optional context; it's the difference between this product working and silently lying.

## Non-negotiable rules, restated briefly (full reasoning in the SKILL file and PRD Section 5)

1. **Never treat Moss's similarity score as a verdict.** Retrieval finds a candidate passage; a separate classification call decides SUPPORTED / CONTRADICTED / UNVERIFIABLE. A sentence that flips a number or direction word scores *highly* similar to the very passage it contradicts — this is the one bug that would make the whole product's premise false while looking fine in a demo.
2. **Every sentence gets its own fresh Moss query**, independent of whatever context the generation call used.
3. **On any classifier error, timeout, or malformed response, default to AMBER.** Never default to GREEN/SUPPORTED on a failure path — a silent false positive here is the worst possible failure mode this product can have.
4. **Never fabricate a latency number.** The Moss/Baseline A/B toggle (FR-12) must use a real brute-force cosine scan, timed with `performance.now()` around the actual computation — not a `setTimeout` or any other simulated delay.
5. **Sentences render in strict order**, even though retrieval/verdict calls run in parallel. Sentence 5 never shows its color before sentence 3, even if sentence 3's call is still in flight.

## Where things are

- `docs/PRD.md` — full requirements, FR-1 through FR-12, acceptance criteria, failure-mode matrix (Section 13), risk table (Section 15). This is long; read the section relevant to what you're building, and Section 5 ("similarity is not truth") regardless of what you're building.
- `docs/APP_FLOW.md` — the UI state machine and screen-by-screen behavior. Consult this before changing anything UI-facing.
- `docs/TECH_STACK.md` — exact package versions and provider choices (Gemini for LLM calls, `@moss-dev/moss` for retrieval), plus why a database/auth/LiveKit are deliberately absent. Don't add any of those "just in case."
- `docs/IMPLEMENTATION_PLAN.md` — the day-by-day build order. Follow this sequencing; do not build FR-12 (A/B toggle) before FR-1 through FR-9 (the core loop) are solid.

## Explicitly out of scope — do not build these unless the PRD is explicitly updated first

Multi-document upload, authentication, a persistent database, a self-hosted NLI model, voice/audio input, LiveKit/WebRTC. Full list: `docs/PRD.md` Section 9.

## When acceptance criteria and speed pressure conflict

The PRD's FR-8 acceptance criteria requires a real test set (5 direction-flip pairs, 5 number-change pairs) to pass before that stage is considered done. Do not mark FR-8 complete without running this test — "the UI shows colors" is not the same as "the colors are correct," and this specific failure mode is silent (it looks identical to success until someone checks the actual verdict against a known contradiction).
