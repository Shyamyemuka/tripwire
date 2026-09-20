# SUBMISSION_CHECKLIST — Tripwire

Maps every deliverable the hackathon rules actually require to where it lives in this repo. Due **11:59 PM IST, 20 September 2026** (per the hackathon's stated Build Phase & Project Submission window).

| Required deliverable | Where it comes from | Status |
|---|---|---|
| **Architecture Diagram** | Draw from `docs/APP_FLOW.md`'s state machine + `docs/TECH_STACK.md`'s component list. Not yet drawn as an image — do this once the pipeline is built and stable, so the diagram matches reality rather than the plan. | ☐ |
| **PRD** | `docs/PRD.md` (also the locked `Tripwire_PRD_v1.1.docx`) | ✅ Locked v1.1 |
| **GitHub Repository** | This repo. Push early — an empty/near-empty repo with a clear README and commit history from Day 1 reads better to judges than one big Day-3 commit. | ☐ |
| **Deployed Link** | Vercel deployment. Click every button on the *actual deployed link* — not localhost — before submitting; production-only bugs are the worst kind to discover after the deadline. | ☐ |
| **Video Demo** | Record `docs/DEMO_SCRIPT.md` end to end. Record it once clean as a backup even if you also plan a live moment. | ☐ |

## Before you submit, confirm

- [ ] The build-window number in `docs/PRD.md`'s header table still matches reality (it currently says 3 days/72 hours — this was flagged once already as worth double-checking and never explicitly confirmed).
- [ ] `.env.example` lists every environment variable the deployed app actually needs, and the Vercel project has all of them set — a missing key on the deployed link is invisible until a judge tries it.
- [ ] The Moss project's free-tier limits (1 project, 3 indexes, 1,000 items/index) comfortably cover your pinned demo document's chunk count.
- [ ] Gemini's free-tier RPD hasn't been burned by rehearsal before the actual demo — RPD resets at midnight Pacific time, not local time, so plan rehearsals accordingly the day before.
- [ ] At least one deliberately-planted contradiction test (PRD Section 8, FR-8 acceptance criteria) still resolves to RED, not GREEN, on the current deployed build — re-run this after every deploy, not just once during development.
- [ ] `docs/PRD.md` Section 9 ("out of scope") still matches what you actually built — if you ended up adding or dropping something under time pressure, update this section so the PRD reflects the real submission, not the plan.

## After finalists are announced (23 September) — only relevant if selected

- [ ] Revisit `docs/TECH_STACK.md`'s fallback-provider plan (OpenRouter / Nvidia NIM) if Gemini's free tier proved too tight for a live judged room.
- [ ] Prepare the finals presentation: product demo, architecture explanation, and an explicit "how Moss improves our speed/latency" section, per the hackathon's stated Grand Finale format.
