# IMPLEMENTATION_PLAN — Tripwire

Build window: **3 days (72 hours)**, solo, concurrent with an academic placement drive (per `docs/PRD.md` header table — confirm this number is still accurate before Day 1; everything below assumes it is).

**The single rule that governs sequencing:** get the core verified-streaming loop (FR-1 → FR-9) working end-to-end before spending time on anything else. A broken sentence-splitter or a misfiring verdict step on Day 3 is far worse than a missing A/B toggle — polish is droppable, the core loop is not.

Every FR number below refers to `docs/PRD.md` Section 8. Every fallback referenced is in Section 13's matrix.

---

## Day 1 — Make the pipeline exist, even ugly

**Goal by end of day: typed question in → colored sentences out, on your own terminal/localhost, no styling.**

1. **Sign up for both external services first, before writing any code.** Moss (`moss.dev`, get `project_id`/`project_key`) and Gemini (Google AI Studio, get an API key). A build day lost to "waiting on an account" is the single most avoidable failure mode.
2. Scaffold the Next.js 16 project (see `docs/TECH_STACK.md` for exact package versions). Get `npm run dev` serving a blank page before anything else.
3. **Document intake (FR-1):** file upload or paste-text input → extract raw text. Test the size-limit fallback (FR-2: 20 pages / ~8,000 words) with a deliberately oversized file today, not later — this is a listed failure mode in Section 13 and it's cheap to verify now.
4. **Chunking + Moss indexing (FR-2):** split into ~200-word overlapping chunks, `createIndex` + `loadIndex` via `@moss-dev/moss`. Confirm you can `query()` and get a real result with a real `timeTakenInMs` back — this number is going in your UI verbatim later, so see it work now.
5. **Generation (FR-4):** wire the question input to a streaming Gemini call, whole-document-stuffed as context (the v1.1 fix). Get tokens appearing in a `console.log` before touching any UI.
6. **Sentence boundary detection (FR-5):** this is the step most likely to silently produce garbage if rushed. Build the abbreviation/decimal guards *first*, then test against the 15-sentence adversarial set the PRD's own acceptance criteria demands (Mr., Dr., e.g., "$3.5 million", multi-sentence quotes) before moving on.

**End-of-day checkpoint:** can you paste a document, ask a question, and see the answer split into correct sentences in your terminal? If not, nothing else this week matters yet — stay here.

---

## Day 2 — Make it verify

**Goal by end of day: sentences are colored correctly, in the browser, for real questions against a real document.**

1. **Trivial-claim filter (FR-6):** cheap heuristic or a tiny classification call — either is fine, this step doesn't need to be sophisticated, it needs to not waste retrieval calls on "However,".
2. **Fast path — Moss retrieval (FR-7):** fresh query per completed sentence, top-3, independent of generation context (do not reuse whatever context the generation call happened to use — this is the specific bug the PRD's "similarity is not truth" section exists to prevent you from writing).
3. **Verdict classification (FR-8):** the strict short Gemini Flash-Lite prompt, given the sentence + top-3 passages. **Build the direction-word/number test set now**: at minimum 5 pairs with a flipped direction word and 5 with a changed number, and confirm every one classifies CONTRADICTED, not SUPPORTED. This is the one test in the whole PRD that, if skipped, can make your demo show a hallucination as verified truth on stage — do not defer it to "later testing."
4. **UI wiring (FR-9):** render the four-state colors, in strict per-turn order, with the retrieval-latency counter. Get this on screen before building anything prettier.
5. Start the rate-limit mitigation now, not on Day 3: a small concurrency cap + exponential backoff around the verdict/explanation calls, defaulting to AMBER on exhausted retries (never GREEN). Given Gemini free tier's ~10–15 RPM ceiling (`docs/TECH_STACK.md`), you will hit this while testing today, which is the best possible time to hit it.

**End-of-day checkpoint:** open the app in an actual browser, ask a real question about a real document, and watch sentences turn green/red/amber/grey correctly, including at least one deliberately-contradicted test sentence you planted.

---

## Day 3 — Explanation, source panel, A/B toggle, then stop and rehearse

**Goal by end of day: a demo you could show a stranger without narrating around gaps, recorded, submitted.**

Priority order for today, in this exact sequence — drop from the bottom if the clock runs out, never from the top:

1. **Slow path — explanation (FR-10):** the one-line mismatch explanation, non-blocking, appearing after the color.
2. **Source panel (FR-11):** click a colored sentence, see the matched passage + page + score.
3. **Multi-turn Q&A (v1.1 fix, PRD Section 10.3):** confirm asking a second and third question in one session appends new turns and keeps prior turns visible, per your own test script (Section 14.1).
4. **A/B toggle (FR-12):** wire the real brute-force cosine baseline (not a hosted vector DB, not a fake delay — see `docs/TECH_STACK.md`). Verify with a stopwatch that the gap is real before trusting it in front of anyone.
5. **Stop building with real time to spare.** Pin your actual demo document. Run `docs/DEMO_SCRIPT.md` end to end, at least twice, at whatever pace Gemini's real streaming speed gives you — not a slower local mental pace. Record the video demo. Fill in `docs/SUBMISSION_CHECKLIST.md`. Push to GitHub. Deploy to Vercel and click every button on the live deployed link before submitting — a bug that only appears in production, discovered after 11:59 PM IST, is the worst possible way to lose points on a finished product.

**If Day 3 runs out before step 4:** ship without the A/B toggle. A working core loop with an honest "toggle not built due to time" note beats a broken toggle bolted onto a rushed core loop. Never trade FR-1 through FR-9 stability for FR-12 polish.

---

## Explicitly deferred to a Bangalore-finals round only (do not build this week)

- Multi-document upload
- A second LLM provider (OpenRouter / Nvidia NIM) as a live fallback behind Gemini — see `docs/TECH_STACK.md`'s fallback plan for the shape this would take
- Any persistence layer

Building these now would be scope creep against a 3-day window with no requirement forcing it yet.
