# Tripwire

**Live, sentence-by-sentence hallucination detection for streaming LLM answers, powered by Moss.**

Built for the **YC Fall 2026 x Moss — Zero Latency Builder Sprint**, Track 4: Agent Reliability, Security and Evaluation.

> As an LLM streams its answer to a question about an uploaded document, Tripwire fact-checks each sentence against the source in near real time — underlining it green (supported), red (contradicted), amber (unverifiable), or grey (not a factual claim) within milliseconds of the sentence finishing. Moss's sub-10ms retrieval is what makes verifying *while streaming* possible at all, instead of the industry-standard approach of checking only after generation finishes.

A live "Moss vs. real brute-force baseline" toggle lets anyone watch verification fall behind the text the moment Moss is switched off.

---

## Why this exists

Every existing grounding/hallucination-check tool (Guardrails, Ragas, LangSmith, etc.) verifies **after** the LLM finishes generating, because a normal retrieval round-trip (150–500ms) is slower than the ~20ms gap between streamed tokens. By the time a hallucination is caught, the user has already read it.

Moss's sub-10ms retrieval removes that bottleneck. Tripwire exists to prove, on stage, that inline live verification — not post-hoc evaluation — becomes possible once retrieval is fast enough to fit inside the stream.

## The one rule this whole product is built around

**Similarity is not the same as truth.** A sentence that flips a number or a direction word ("costs *decreased* 30%" vs. source "costs *rose* 8%") will score a *high* similarity match against the very passage it contradicts, because most of the words are identical. Tripwire never treats "found a similar passage" as "verified true" — retrieval (Moss) finds the candidate, and a separate verdict step classifies the relationship. See `docs/PRD.md` Section 5 and `skills/tripwire-pipeline/SKILL.md` for the full reasoning; do not build around this rule without reading it first.

## Repo layout

```
tripwire/
├── README.md                          — you are here
├── CLAUDE.md                          — project-level agent instructions (read automatically by Claude Code / Claude in Antigravity)
├── .env.example                       — required API keys, copy to .env
├── .gitignore
├── docs/
│   ├── PRD.md                         — full product requirements (v1.1, locked)
│   ├── APP_FLOW.md                    — screen-by-screen and state-by-state user flow
│   ├── TECH_STACK.md                  — exact pinned versions and why each was chosen
│   ├── IMPLEMENTATION_PLAN.md         — day-by-day build plan for the ~3-day window
│   ├── DEMO_SCRIPT.md                 — the exact script to rehearse and record
│   └── SUBMISSION_CHECKLIST.md        — maps every hackathon-required deliverable to its file/link
└── skills/
    └── tripwire-pipeline/
        └── SKILL.md                  — the 5 non-negotiable pipeline invariants, for any agent touching this code
```

## Quick start (once the app exists)

```bash
cp .env.example .env      # fill in MOSS_PROJECT_ID, MOSS_PROJECT_KEY, and your LLM provider key
npm install
npm run dev               # http://localhost:3000
```

## Build status

PRD locked at v1.1. Not yet implemented. Start with `docs/IMPLEMENTATION_PLAN.md` Day 1, Step 1.

## Explicitly out of scope for this build

Multi-document upload, authentication, persistent database, self-hosted NLI models, and any fabricated/simulated latency number anywhere in the product. Full list in `docs/PRD.md` Section 9.
