# APP_FLOW — Tripwire

Screen-by-screen, state-by-state. This is the authoritative reference for what the UI does at every point — if this document and a chat message disagree, this document wins unless the PRD (`docs/PRD.md`) says otherwise.

Every requirement referenced below (FR-1 … FR-12) is defined in full in `docs/PRD.md` Section 8. This file describes *flow and state*; the PRD is the source of truth for *acceptance criteria*.

---

## Screen 1 — Empty State (first load)

**Shown:** A single centered upload/paste panel. Title, one-line pitch, a document drop zone, and a "or paste text" toggle. No sidebar, no chrome — nothing to distract from the one action available.

**User can:**
- Drag/drop or browse to a PDF/text file, or
- Paste raw text directly

**On submit → Screen 2.**

If the document exceeds 20 pages / ~8,000 words (FR-2): index up to the first threshold reached, and immediately show a persistent, dismissible banner: *"Document truncated — only pages 1–N indexed."* This banner stays visible for the rest of the session; it does not silently disappear.

If the file has no extractable text (scanned image PDF): block before indexing, show *"Couldn't extract text from this PDF — try a text-based PDF or paste the content directly."* Do not proceed to Screen 2 (FR-1 fallback).

---

## Screen 2 — Session Workspace (main screen, all activity happens here)

Three-zone layout: **top bar**, **Q&A thread (center, scrollable)**, **question input (bottom, fixed)**.

### Top bar

| Element | Behavior |
|---|---|
| Document name + page count | Static, set once on Screen 1 submit |
| Truncation banner (if applicable) | Persists per above |
| **Moss / Baseline toggle** (FR-12) | Switches which retrieval path future questions use. **Does not retroactively change already-rendered turns** — see "A/B toggle scope" below |
| Live latency readout | Shows the retrieval time of the most recently resolved sentence, labelled explicitly `Moss retrieval: Nms` or `Baseline retrieval: Nms` — never an unlabelled number |
| Cumulative counter (FR-9) | `verified N claims · avg Nms` — cumulative across every turn in `qaTurns` this session, not reset per question |

### Q&A thread

Renders `session.qaTurns` (PRD Section 10.3) top to bottom, oldest first. Each turn is a self-contained block:

```
┌─────────────────────────────────────────┐
│ Q: "Summarise the financial highlights"  │
│                                           │
│ The company had a strong quarter.        │  ← GREY, no underline
│ Revenue increased 10% to $45M in Q3.     │  ← GREEN underline
│ Operating costs decreased 30% from       │  ← RED underline
│ last year. [ⓘ Source says costs rose     │
│ 8%; this sentence claims a 30% decrease] │
└─────────────────────────────────────────┘
```

- Colour appears the instant a sentence's verdict resolves (FR-9) — never waits for the explanation.
- Explanation text (FR-10) fades in below a RED/AMBER sentence 0.5–1s later. Non-blocking; a colour is never held up waiting for its explanation.
- Clicking any coloured (non-grey) sentence opens the **Source Panel** (below).
- Older turns remain fully rendered and scrollable above the active turn — never collapsed, never cleared (per the multi-turn fix in PRD v1.1).

### Question input (bottom, fixed)

Plain text box + submit. Disabled while a previous turn is still streaming/verifying, to keep the ordered queue (FR-5) unambiguous — a second question cannot interleave with an in-flight sentence stream.

---

## Source Panel (overlay/drawer, triggered by clicking a sentence)

Shows:
- The exact matched passage text (or top-3, if the sentence is RED — showing all three helps demonstrate *why* the verdict step didn't just pick the top-similarity match; see FR-7/FR-8)
- Page number / character offset
- Similarity score
- Verdict (SUPPORTED / CONTRADICTED / UNVERIFIABLE) restated explicitly, not just implied by colour

Closing the panel returns to the exact scroll position in the thread — clicking a sentence must never lose the user's place.

---

## State machine (per sentence, FR-5 → FR-10)

```
PENDING
   │  (sentence boundary closes — FR-5)
   ▼
FILTERED-OUT ──────────────────────────► GREY (terminal, FR-6)
   │ (not filtered)
   ▼
RETRIEVING (Moss/baseline query in flight — FR-7)
   │
   ├─ no candidate clears similarity floor ──► AMBER (terminal, "no related passage found")
   │
   ▼
VERDICT-PENDING (verdict LLM call in flight — FR-8)
   │
   ├─ classifier error/timeout/malformed ──► AMBER (terminal, never GREEN — FR-8 fallback)
   │
   ├─► SUPPORTED  → GREEN (terminal)
   ├─► CONTRADICTED → RED (terminal) ──► EXPLANATION-PENDING (FR-10, non-blocking) ──► explanation text appended
   └─► UNVERIFIABLE → AMBER (terminal) ──► EXPLANATION-PENDING (FR-10, non-blocking) ──► explanation text appended
```

Sentences are dispatched to RETRIEVING/VERDICT-PENDING **in parallel** — multiple sentences may be mid-flight at once — but the UI renders each sentence's colour only once every sentence *before* it in the same turn has already rendered (FR-5's strict-order requirement). A sentence that resolves out of order waits, rendered, in a hidden queue until its turn comes.

---

## A/B toggle scope (FR-12)

- Flipping the toggle takes effect on the **next question submitted**, not the currently-rendering turn.
- Each turn's `qaTurns` record stores which mode (`moss` | `baseline`) it ran under, so historical turns keep showing whichever mode they actually used even after the toggle is flipped again — this is what makes the side-by-side comparison legible when scrolling back.

---

## Error / fallback states (summary — full matrix in `docs/PRD.md` Section 13)

| Situation | User sees |
|---|---|
| Generation provider timeout/error (FR-4) | Explicit error banner on that turn; question stays in the input, retry without re-upload |
| Stream ends mid-sentence (FR-5) | Remaining buffer flushed as a final sentence — never silently dropped |
| Moss/baseline query returns nothing above the similarity floor (FR-7) | Sentence goes straight to AMBER, verdict step skipped entirely |
| Verdict/explanation call hits a provider rate limit (429) | Bounded retry with backoff; on exhausted retries, sentence defaults to AMBER (never blocks the rest of the queue) |
| A/B baseline is genuinely as fast as Moss on a small doc | Shown honestly — do not fabricate a gap; see `docs/PRD.md` Section 11.2 |
