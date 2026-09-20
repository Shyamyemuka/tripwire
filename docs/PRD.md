**PRODUCT REQUIREMENTS DOCUMENT**

**Tripwire**

*Real-Time, Sentence-Level Hallucination Detection for Streaming LLM Output*

YC Fall 2026 x Moss — The Zero Latency Builder Sprint

Track 4 — Agent Reliability, Security and Evaluation

|                                |                                                                       |
|--------------------------------|-----------------------------------------------------------------------|
| **Document Owner**             | Shyam — Solo Builder / Author                                         |
| **Document Status**            | Final — Locked for Build (v1.1)                                       |
| **Document Type**              | Product Requirements Document (PRD)                                   |
| **Classification**             | Hackathon Submission — Public                                         |
| **Version**                    | 1.1 — fixes doc size limit, generation context assembly, multi-turn Q&A data model, top-k verdict input, verdict/explanation rate-limit risk, and pins Gemini (not Groq/Cerebras) as the build's LLM provider vs. v1.0 |
| **Last Updated**               | 16 September 2026                                                     |
| **Build Window**               | 3 days (72 hours), solo, concurrent with academic placement drive     |
| **Primary Sponsor Dependency** | Moss (sub-10ms retrieval API)                                         |
| **Default Stack**              | Next.js + TypeScript + Tailwind, Next.js API routes, Moss SDK, Vercel |

Table of Contents

**1. Executive Summary** 3

**2. Problem Statement** 4

**3. Goals and Non-Goals** 5

**4. Target Users and Personas** 6

**5. Success Metrics** 7

**6. Scope Summary** 8

**7. User Stories** 9

**8. Functional Requirements** 10

**9. System Architecture** 15

**10. Data Model** 17

**11. Latency Budget and Feasibility Analysis** 18

**12. Non-Functional Requirements** 20

**13. Failure Modes and Fallback Matrix** 22

**14. Testing and Validation Strategy** 23

**15. Risks and Mitigations** 24

**16. Build Timeline (3-Day / 72-Hour Window)** 25

**17. Submission Checklist and Judging Alignment** 26

**18. Worked Example (Reference Demo Script)** 27

**19. Open Questions and Future Work (Post-Hackathon)** 28

**20. Glossary** 29

1\. Executive Summary

Tripwire is a fact-verification layer that sits between a streaming LLM response and the end user, checking every sentence against a source document as it is generated — not after the response finishes. Existing grounding-check tools (Guardrails, Ragas, LangSmith, and similar evaluation frameworks) are structurally after-the-fact: they score a completed response once generation is done, because standard vector-database retrieval takes 150–300 milliseconds, which is slower than the ~20 millisecond gap between streamed tokens. By the time a hallucinated claim is flagged, the user has already read and internalized it.

Moss's sub-10 millisecond retrieval removes this constraint. It is not treated in this document as a performance optimization; it is treated as the enabling condition without which the product category described here — inline, sentence-level, live verification of a streaming answer — is not achievable with a normal vector store. This document is written to make that dependency explicit, falsifiable, and demonstrable, rather than asserted.

The product is scoped deliberately narrowly for a 3-day solo build: single-document upload, no accounts, no persistence beyond a browser session, and exactly three LLM call shapes (generation, verdict, explanation). Every feature has an explicit fallback behavior so that no failure mode silently produces a false "verified" result — the single worst possible outcome for a product whose entire value proposition is catching false claims.

**Core deliverable for the hackathon:** a working demo in which a judge uploads a document, asks a question, watches the answer stream with live green/red/amber/grey sentence-level verdicts, and can toggle a switch that swaps Moss for a real brute-force baseline retrieval — visibly and honestly demonstrating the latency gap that is the basis of the sponsor pitch.

2\. Problem Statement

2.1 The Core Problem

When an LLM answers a question about a document — a financial report, a contract, a research paper, a policy document — it can and does generate sentences that are unsupported by, or directly contradict, the source material. This is a well-documented failure mode ("hallucination" or "ungrounded generation") and it is especially costly in high-stakes domains: finance, legal, medical, and enterprise decision support, where a fabricated number or reversed direction ("costs decreased" vs. the source's "costs increased") can lead directly to a bad decision.

2.2 Why Existing Solutions Do Not Solve It

Retrieval-augmented generation (RAG) evaluation tools such as Ragas, TruLens, Guardrails AI, and LangSmith's evaluation tooling all operate on a completed response. Structurally, they cannot do otherwise with a standard vector database, because:

- A typical hosted vector DB (Pinecone, Weaviate, pgvector, Chroma) returns a similarity search result in roughly 150–300 milliseconds under realistic network and index conditions.

- LLM providers stream tokens with inter-token gaps on the order of 15–40 milliseconds at typical throughput (25–60 tokens/sec for mid-size hosted models).

- A verification step that takes 10–20x longer than the gap between tokens cannot run inline without stalling the stream to the point of defeating the purpose of streaming — so every existing tool defers verification to "after the response is complete," trading immediacy for correctness.

The consequence: today, a user reads the entire hallucinated claim, forms a belief or makes a decision based on it, and only afterward — if the tool is used at all — receives a correction. In a live meeting, a support chat, or a financial briefing, that correction frequently arrives too late to matter.

2.3 The Non-Obvious Failure Mode This PRD Is Designed Around

The naive version of this idea — "do retrieval fast, show similarity score" — fails in a way that is worse than doing nothing at all. If a generated sentence says "revenue increased 10%" and the source says "revenue decreased 10%," a semantic similarity search will return that exact source passage with a very high similarity score, because the two sentences share nearly every word except the direction. A system that equates high similarity with correctness will label a direct contradiction as VERIFIED / SUPPORTED. For a hallucination-detection product, a confident false positive is strictly worse than an admitted unknown, because it actively increases the user's misplaced trust. Section 8 (Functional Requirements) and Section 12 (Failure Modes) treat this as the central design constraint the entire pipeline is built around, not an edge case handled later.

2.4 Why Now / Why This Hackathon

The constraint that has made inline verification impossible — retrieval latency — is specifically what this hackathon's sponsor (Moss) claims to have solved. This PRD treats that claim as a hypothesis to be tested and demonstrated live, via a real, honest, in-product A/B comparison against a genuine brute-force baseline, rather than asserted in a slide.

3\. Goals and Non-Goals

3.1 Goals (Hackathon Build)

- Demonstrate sentence-level, streaming-time verification of an LLM's answer against a single uploaded source document, with a visible verdict rendered within milliseconds of each sentence completing.

- Demonstrate, with real (not simulated) timing, that Moss's retrieval latency is the specific enabling factor that makes this inline — by providing a genuine brute-force baseline for direct comparison inside the same product.

- Avoid the single worst failure mode for this category of product: never present an unverified or contradicted claim as confidently correct.

- Ship an end-to-end working system — not a slide deck or a mocked UI — within a 3-day solo build window that overlaps with the author's academic placement-drive commitments.

- Produce a submission package (repo, deployed link, architecture diagram, PRD, video demo) that is coherent, honest about its scope, and reviewable by a technical judge in under 5 minutes.

3.2 Explicit Non-Goals (Out of Scope for This Build)

- Multi-document upload or cross-document question answering. (Candidate for a future round if selected as a finalist — see Section 15, Future Work.)

- User accounts, authentication, or any login flow.

- Persistent storage of documents, sessions, or verification history across visits. In-memory / client-side React state for the duration of a single session is sufficient and intentional.

- Self-hosted natural language inference (NLI) models for the verdict step. A hosted LLM call is used instead, specifically to minimize infrastructure and setup burden within the time budget (see Section 9.3).

- Any fabricated, simulated, or hardcoded latency number anywhere in the product. Every millisecond value shown to a judge must be a real, measured value at request time.

- Support for scanned/image-only PDFs requiring OCR (explicitly deferred — see Section 12.4).

- Mobile-optimized layout (desktop-first demo is acceptable for a judged hackathon context).

4\. Target Users and Personas

This build targets two distinct audiences simultaneously, and the product is designed so that both can be served by the same demo without compromise:

4.1 Persona A — Hackathon Judge (Immediate Audience)

|                        |                                                                                                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Who**                | A sponsor engineer or YC-affiliated technical judge evaluating ~15–30 submissions in a limited review window.                                                      |
| **Goal**               | Quickly assess whether the submission genuinely uses Moss in a way that would not be possible (or would be materially worse) without it.                           |
| **Behavior**           | Will upload their own test document if the demo allows it; will look for the A/B toggle specifically; will be skeptical of unverified performance claims.          |
| **Success looks like** | Judge can, within 2 minutes, watch a claim get verified live, watch a contradiction get caught and explained, and flip the toggle to see the baseline visibly lag. |

4.2 Persona B — Real-World End User (Product-Market Framing)

|                        |                                                                                                                                                                           |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Who**                | An analyst, lawyer, or operator using an internal LLM assistant to summarize or query a long document (earnings report, contract, policy doc) under time pressure.        |
| **Goal**               | Trust — or correctly distrust — specific sentences of an AI-generated answer without having to manually re-read the entire source document.                               |
| **Behavior**           | Skims the streamed answer; relies on color cues rather than re-verifying everything manually; clicks into the source panel only for claims that matter to their decision. |
| **Success looks like** | A false claim is caught and visibly flagged before the user has finished reading past it and acted on it.                                                                 |

The PRD prioritizes Persona A for the 3-day build (the judged deliverable) while ensuring every design decision remains defensible and coherent from Persona B's perspective — i.e., this is not a demo built to look good only under judging conditions.

5\. Success Metrics

5.1 Hackathon Success Criteria (Primary)

| **Metric**                                                                          | **Target**                                                                           | **How Measured**                                                     |
|-------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| Core loop functional end-to-end (upload → question → streamed, colour-coded answer) | 100% working, no crashes, on the pinned demo document                                | Live run-through + backup video                                      |
| Moss retrieval latency shown live                                                   | \< 30ms p95 on demo document                                                         | On-screen running counter, real timestamps                           |
| Baseline vs. Moss gap visibly demonstrated                                          | Baseline retrieval measurably and visibly slower; queue backlog observable on screen | A/B toggle live comparison                                           |
| False-positive rate on demo script (confident GREEN on a contradicted sentence)     | 0 occurrences                                                                        | Manual review of pinned demo Q&A pairs, run 5+ times for consistency |
| Time for a judge to understand the core value prop unaided                          | \< 2 minutes                                                                         | Dry run with a non-technical friend/classmate before submission      |
| Submission completeness                                                             | Repo + deployed link + architecture diagram + PRD + video, all present               | Checklist against portal requirements                                |

5.2 Product Metrics (If This Were Continued Past the Hackathon)

- Sentence-level verdict accuracy against a human-labeled evaluation set (target: establish a baseline; no committed number pre-launch).

- Median and p95 end-to-end time from "sentence completes streaming" to "colour appears" (target: keep p95 verdict latency low enough that it never becomes the visible bottleneck relative to generation speed).

- False-negative rate (a real contradiction marked GREEN) tracked as the single most important quality metric, weighted above overall accuracy, because it is the failure mode that erodes user trust fastest.

- User override rate — how often a user manually re-checks a GREEN sentence via the source panel — as a proxy for residual distrust.

6\. Scope Summary

| **In Scope (v1 / Hackathon Build)**                              | **Out of Scope (This Build)**                    |
|------------------------------------------------------------------|--------------------------------------------------|
| Single document upload (PDF or pasted text)                      | Multiple / cross-document upload                 |
| Chunking + indexing into Moss                                    | Persistent vector store across sessions          |
| Streaming Q&A generation                                         | User accounts / authentication                   |
| Sentence-boundary detection on token stream                      | Saved history across visits                      |
| Trivial-claim filtering (skip non-factual sentences)             | Self-hosted NLI model                            |
| Verdict classification (SUPPORTED / CONTRADICTED / UNVERIFIABLE) | Fabricated or simulated latency figures          |
| Live colour-coded UI with running latency counter                | OCR for scanned/image PDFs                       |
| Async, non-blocking mismatch explanation for AMBER/RED           | Mobile-optimized responsive layout               |
| Clickable source panel (passage, page, similarity score)         | Team accounts / sharing / collaboration features |
| Real brute-force baseline + live A/B latency toggle              | Analytics dashboards / usage tracking            |

7\. User Stories

| **ID** | **As a...**                | **I want to...**                                                      | **So that...**                                                     |
|--------|----------------------------|-----------------------------------------------------------------------|--------------------------------------------------------------------|
| US-1   | judge/user                 | upload a single PDF or paste text                                     | I can ask questions about a document I control                     |
| US-2   | judge/user                 | ask a free-text question about the document                           | I get a natural-language answer, not just retrieved snippets       |
| US-3   | judge/user                 | watch the answer stream in as it's generated                          | the experience feels like a normal chat interface, not a batch job |
| US-4   | judge/user                 | see each sentence coloured the moment it's verified                   | I don't have to wait for the full answer to know what to trust     |
| US-5   | judge/user                 | see a one-line explanation for any flagged sentence                   | I understand \*why\* something is wrong without digging myself     |
| US-6   | judge/user                 | click a flagged (or any) sentence to see the exact source passage     | I can independently confirm the verdict                            |
| US-7   | judge (sponsor evaluation) | toggle between Moss and a real baseline retrieval                     | I can see, with real numbers, what Moss specifically enables       |
| US-8   | judge/user                 | be told explicitly when a document was truncated                      | I don't unknowingly get answers based on partial context           |
| US-9   | judge/user                 | never see a confidently-wrong (green) verdict on a contradicted claim | I can trust the tool more than I trust my own unaided reading      |

8\. Functional Requirements

Requirements are listed in pipeline order. Each stage's fallback behaviour is a first-class requirement, not an afterthought — a stage with an undefined failure mode is not considered complete.

FR-1 — Document Intake

The user either uploads a single PDF file or pastes raw text into a text area. This is the only ingestion path in v1.

**Requirements:**

- Accept exactly one document per session: PDF upload or pasted plain text.

- No support for multi-document upload in this version (see Section 3.2).

**Acceptance criteria:**

- A single valid PDF or pasted text block is accepted and moves the session into 'indexing' state.

- Unsupported file types (docx, images, etc.) are rejected with a clear, specific error message, not a silent failure.

**Fallback / failure behaviour:** If PDF text extraction returns empty or near-empty content (e.g., a scanned image PDF with no embedded text layer), the UI must explicitly tell the user the document could not be read as text, rather than silently proceeding with an empty index.

FR-2 — Chunking and Indexing into Moss

The document is split into overlapping windows so that a fact spanning a chunk boundary is still captured whole in at least one chunk. Overlap is set at ~20% of chunk size as a standard information-retrieval default, balancing recall against index bloat and per-query cost.

**Requirements:**

- Split document into overlapping passages of ~200 words with ~40-word overlap.

- Each chunk is indexed into Moss with metadata: page number, character offset range, and a stable chunk ID.

- A hard document size limit of 20 pages or approximately 8,000 words (whichever threshold is reached first) is enforced before indexing begins.

**Acceptance criteria:**

- Every chunk indexed into Moss carries page number + character offset + chunk ID, enabling exact source-panel lookups later (FR-11).

- Indexing completes and the UI transitions to 'ready for questions' before the user can submit a query.

**Fallback / failure behaviour:** If the document exceeds 20 pages or ~8,000 words, only content up to the first threshold reached is indexed, and a persistent, visible on-screen notice states that truncation occurred and which pages were excluded. Truncation is never silent.

FR-3 — Question Input

The user types a natural-language question about the uploaded document and submits it.

**Requirements:**

- Single free-text input box.

- No voice input, no authentication, no saved query history.

**Acceptance criteria:**

- Empty or whitespace-only submissions are blocked client-side with an inline message.

FR-4 — Streaming Answer Generation

A standard RAG-style generation call answers the user's question, using the indexed document as context, and streams its output exactly as a normal LLM chat interface would.

**Requirements:**

- The generation model streams its answer token-by-token to the frontend using standard server-sent events / streaming response.

- The model and provider used for this call must support genuine low-latency token streaming (see Section 11, Latency Budget, for why this choice materially affects the demo's success).

- Context assembly for the generation call uses whole-document stuffing, not a preliminary retrieval pass: because the indexed document is capped at 20 pages / ~8,000 words (FR-2), the full (possibly truncated) document text is passed directly into the generation prompt. No separate retrieval query selects a subset of the document for the generation call. This is deliberately simpler than a two-stage RAG generation pipeline and does not weaken FR-7's independence requirement -- each sentence is still verified against a fresh, independent Moss query after the fact, regardless of how generation was grounded.

**Acceptance criteria:**

- Tokens appear incrementally in the UI, not as a single blocking response.

- Generation failure (timeout, provider error) surfaces a visible, specific error state rather than a stalled spinner.

**Fallback / failure behaviour:** On generation-provider failure, the session shows an explicit error and allows the user to retry the same question without re-uploading the document.

FR-5 — Sentence Boundary Detection

This stage converts a raw token stream into discrete, verifiable units (sentences) without breaking mid-abbreviation or mid-number, both of which are common and easy-to-miss sources of false sentence splits in naive implementations.

**Requirements:**

- Buffer incoming tokens; close a sentence only on terminal punctuation ('.', '?', '!') followed by whitespace and either a capital letter or end-of-stream.

- Explicitly guard against false splits on: common abbreviations (Mr., Dr., e.g., approx., single-letter initials) and decimal numbers (e.g. '\$3.5 million' must not split after '3').

- Completed sentences enter an ordered processing queue.

**Acceptance criteria:**

- A test set of at least 15 sentences containing abbreviations, decimals, and multi-sentence quotes is run through the detector with zero false splits before this stage is considered done.

- Sentences are verified strictly in the order they complete — sentence 5 must never render its colour before sentence 3, even if sentence 3's verdict call is still in flight.

**Fallback / failure behaviour:** If the stream ends mid-sentence (e.g., truncated generation), whatever remains in the buffer is flushed and treated as a final sentence rather than silently dropped.

FR-6 — Trivial-Claim Filtering

Not every sentence in an LLM's answer makes a checkable claim. Spending a retrieval + verdict call on filler sentences wastes latency budget and API cost for zero verification value.

**Requirements:**

- Sentences with no checkable factual content (pure opinion, filler, transition phrases — e.g. 'However,' 'This is a strong approach.') are filtered before any Moss call is made.

- Filtered sentences are immediately tagged GREY ('not a factual claim').

**Acceptance criteria:**

- A held-out set of 10 known-filler sentences and 10 known-factual sentences classifies with at least 90% accuracy in manual review before this stage is considered acceptable for demo use.

**Fallback / failure behaviour:** If the filter is uncertain, it must err toward treating the sentence as checkable (i.e., false negatives on the filter — sending a filler sentence for verification — are an acceptable cost; false positives — skipping a real claim — are not).

FR-7 — Fast Path — Moss Retrieval

This is the step that is only possible at this speed because of Moss. Each sentence gets an independent retrieval query against the full indexed document, so the system can catch both contradictions of the source and claims that go beyond anything the source actually says (i.e., claims with no supporting passage at all, not just claims that conflict with one).

**Requirements:**

- Query Moss fresh with the completed sentence's own text — never reuse whatever context window the generation call happened to use.

- Retrieve the top-3 candidate passages with similarity scores (k=3, fixed), all of which are passed forward to the verdict step (FR-8).

- Target latency: under 10–30ms per query.

**Acceptance criteria:**

- Every non-filtered sentence issues its own Moss query, independent of the generation call's context.

- Real, measured retrieval latency (not simulated) is captured and surfaced in the UI's running counter (FR-9).

**Fallback / failure behaviour:** If no candidate passage clears a minimum similarity floor, the verdict step (FR-8) is skipped entirely and the sentence is marked AMBER ('no related source passage found') — the system does not force a verdict when there is nothing relevant to judge against.

FR-8 — Verdict Classification — The Similarity-Is-Not-Truth Safeguard

This is the single most important requirement in the document. High semantic similarity between a generated sentence and a source passage does not imply the sentence is correct — a sentence can share nearly every word with a source passage and still directly contradict it by reversing one number or one direction word. Retrieval (FR-7) and truth-judgment (FR-8) are therefore two separate mechanisms with two separate jobs, and neither is allowed to substitute for the other.

**Requirements:**

- Runs only when FR-7 found a relevant passage.

- Implemented as a single small/cheap LLM call (explicitly not a self-hosted NLI model — see Section 3.2 and Section 13 for rationale).

- The prompt is strict and short: given \[generated sentence\] and the top-3 retrieved passages (not just the single best match), respond only with SUPPORTED, CONTRADICTED, or UNVERIFIABLE. Passing multiple candidates guards against the case where the passage that actually proves a contradiction ranks second or third by raw similarity behind a more topically-similar but less specific passage.

- The prompt explicitly instructs the model to check numbers, dates, named entities, and direction/negation words (increased/decreased, rose/fell, is/is not) — not just topical relatedness.

**Acceptance criteria:**

- A test set including at least 5 sentence/passage pairs with a direction-word flip (e.g. 'costs decreased' vs. source 'costs increased') and at least 5 pairs with a changed number (e.g. '30%' vs. source '8%') must be classified CONTRADICTED, not SUPPORTED, before this stage is considered acceptable for demo use.

- Verdict call latency is measured and reported honestly as a distinct, slower number from retrieval latency (target 150–250ms, not sub-10ms — see Section 11).

**Fallback / failure behaviour:** On classifier error, malformed response, or timeout, the sentence defaults to AMBER. It must never default to SUPPORTED/GREEN on any failure path — an unexplained false positive is the single worst outcome this product can produce, and is treated as a shipped-bug-severity issue if it occurs even once during demo rehearsal.

FR-9 — Live UI Update

The UI must never claim a faster number than what is actually being measured. The '9ms' figure refers specifically to Moss retrieval time (FR-7); the fact that the verdict call (FR-8) takes longer is not hidden or blended into this figure.

**Requirements:**

- Each sentence receives an underline colour the moment its verdict resolves: GREEN (supported), RED (contradicted), AMBER (unverifiable), GREY (not a factual claim).

- A running counter updates live, e.g. 'verified 12 claims · avg 9ms', explicitly labelled as retrieval latency, not total pipeline latency. The counter is cumulative across all Q&A turns in the current session (per the qaTurns array in Section 10.3), not reset per question.

**Acceptance criteria:**

- Colour appears within one rendering frame of the verdict resolving — no perceptible additional delay between backend resolution and UI update.

- The latency label on screen is unambiguous about which stage it measures.

FR-10 — Slow Path — Mismatch Explanation

Colour alone tells the user \*that\* something is wrong; the explanation tells them \*why\*, without requiring them to manually open the source panel for every flagged sentence.

**Requirements:**

- Runs only for AMBER or RED sentences.

- A second small/cheap LLM call (same tier as FR-8, different prompt) takes the sentence and its matched passage and produces one short explanatory line, e.g. 'Source says costs rose 8%; this sentence claims a 30% decrease.'

- Non-blocking: streams in roughly 0.5–1s after the colour has already appeared and must never delay FR-9.

**Acceptance criteria:**

- Explanation text appears visibly after, never before or instead of, the colour underline.

- A GREEN or GREY sentence never triggers this call — it only fires for AMBER/RED, keeping API cost proportional to actual issues found.

**Fallback / failure behaviour:** If the explanation call fails or times out, the sentence keeps its colour (RED/AMBER) with no explanation text shown, rather than blocking or showing an error in place of the answer.

FR-11 — Source Panel

This is the mechanism by which a skeptical user (or judge) independently verifies the system's own verdict, rather than being asked to trust it blindly — directly supporting US-6.

**Requirements:**

- Clicking any underlined sentence (any colour) opens a panel showing the exact matched source passage, its page number, and its similarity score.

**Acceptance criteria:**

- Panel opens for sentences of every colour, including GREEN, so a user can audit a 'trusted' claim as easily as a flagged one.

- Displayed page number and offset match FR-2's stored metadata exactly.

FR-12 — A/B Latency Toggle (Sponsor-Facing Demonstration)

This is the specific, sponsor-facing 'wow moment' of the submission, and it is treated in this document as a feature with a real engineering risk (see Section 11.2), not a guaranteed visual — the gap must be validated to actually appear under realistic sentence-arrival timing before the team relies on it in the live demo.

**Requirements:**

- A visible switch labelled 'Moss' vs. 'Baseline'.

- Baseline must be a real brute-force in-memory cosine-similarity scan over the same indexed chunks — not a hosted vector DB call, and not a simulated/artificial delay of any kind.

- Live millisecond readouts are shown for both modes, side by side, from real measured timestamps.

**Acceptance criteria:**

- Switching to Baseline mode causes a measurable, on-screen increase in per-sentence retrieval latency using a genuinely slower real computation over the same data.

- When Baseline is active under realistic sentence-arrival speed, the verification queue visibly backs up relative to the streaming text; this must be confirmed empirically (Section 11.2) before it is relied upon in the live pitch.

- If asked directly, the presenter can truthfully state the baseline number is real, because it is computed the same way every time from the same data, live.

**Fallback / failure behaviour:** This feature is explicitly deprioritized below FR-1 through FR-9 in the build schedule (Section 14) — if time runs out, the core verified-streaming loop ships without it rather than the reverse.

9\. System Architecture

9.1 High-Level Architecture Diagram (Textual)

A rendered architecture diagram (image) is a separate submission artifact per the hackathon's requirements; the structure below is the authoritative source for that diagram and mirrors it exactly.

\[Browser: Next.js Frontend\]

\| 1. Upload document / ask question

v

\[Next.js API Routes\] \<---------------------------+

\| \|

\| 2a. Chunk + index \| 5. Verdict + explanation

v \| calls (fast/cheap tier)

\[Moss Index\] \<---- 2b. store chunks + metadata \|

^ \|

\| 3. Per-sentence retrieval query \|

\| (fresh, independent of generation ctx) \|

\| \|

\[Sentence Boundary Detector\] --(completed sentence)+

^

\| token stream

\[LLM Generation Call\] (standard model, streaming)

^

\| 1b. question + retrieved context

\|

\[Next.js API Routes\] (same box as above, loop closes here)

 

\[In-Memory Brute-Force Cosine Baseline\] -- parallel path,

same chunk store, toggled via A/B switch (FR-12)

9.2 Component Responsibilities

| **Component**                        | **Responsibility**                                                                                                          | **Notes**                                                                                                        |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Next.js Frontend                     | Upload UI, question input, streaming answer render, colour underlines, source panel, A/B toggle, live latency counters      | Client-side React state only; no persistence layer                                                               |
| Next.js API Routes                   | Orchestration: chunking, indexing calls, generation call, sentence queue management, verdict/explanation call orchestration | Serverless functions on Vercel; stateless between requests except for in-session chunk store                     |
| Moss Index                           | Sub-10ms semantic retrieval over indexed document chunks                                                                    | Sponsor dependency; the core enabling technology for this build                                                  |
| In-memory brute-force module         | Real cosine-similarity scan over the same chunk embeddings, used only in Baseline mode                                      | Built in-house; no external DB dependency                                                                        |
| LLM Provider (generation)            | Streams the natural-language answer to the user's question                                                                  | Must support fast token streaming — see Section 11.2 for why the specific provider/model choice affects the demo |
| LLM Provider (verdict + explanation) | Two narrow, cheap, low-latency call shapes: classify sentence-vs-passage relationship; explain a mismatch in one line       | Deliberately the fastest/cheapest available tier — see Section 13                                                |

9.3 Why Not a Self-Hosted NLI Model for Verdicts

A dedicated natural language inference (entailment/contradiction) model would, in principle, be a more classically 'correct' tool for the verdict step than prompting a general-purpose LLM. It is deliberately not used here. Standing up, hosting, and serving a self-hosted model within a 3-day solo build introduces infrastructure risk (model hosting, cold starts, GPU/CPU sizing, deployment complexity) that is disproportionate to its marginal accuracy benefit for a hackathon-scale demo. The chosen approach — one API provider, three distinct prompt shapes (generation, verdict, explanation) — keeps the operational surface area to a single external dependency type, which is the correct tradeoff given the time budget in Section 14.

10\. Data Model

All data is held in-memory / client-side React state for the duration of a single session. Nothing is written to a persistent database in this build (see Section 3.2). The shapes below define the session's internal contract between frontend and API routes, not database tables.

10.1 Chunk Record

| **Field**                       | **Type** | **Description**                                                             |
|---------------------------------|----------|-----------------------------------------------------------------------------|
| chunkId                         | string   | Stable identifier for this chunk within the session                         |
| text                            | string   | ~200-word passage text, with ~40-word overlap with neighbouring chunks      |
| pageNumber                      | integer  | Source page number (PDF) or paragraph index (pasted text)                   |
| charOffsetStart / charOffsetEnd | integer  | Character offsets into the original document, for exact source-panel lookup |
| mossVectorId                    | string   | Reference ID returned by Moss on indexing, used for retrieval-time lookups  |

10.2 Sentence Verification Record

| **Field**          | **Type**       | **Description**                                                             |
|--------------------|----------------|-----------------------------------------------------------------------------|
| sentenceId         | string         | Sequential ID; enforces strict in-order UI rendering (FR-5)                 |
| text               | string         | The completed generated sentence                                            |
| status             | enum           | PENDING \| GREEN \| RED \| AMBER \| GREY                                    |
| matchedChunkId     | string \| null | The chunk returned by retrieval, if any                                     |
| similarityScore    | float \| null  | Raw similarity score from the retrieval step                                |
| retrievalLatencyMs | float          | Real measured Moss (or baseline) retrieval time for this sentence           |
| verdictLatencyMs   | float \| null  | Real measured verdict-call time, reported separately from retrieval latency |
| explanation        | string \| null | One-line mismatch explanation, populated asynchronously for AMBER/RED only  |

10.3 Session State

- documentMeta: filename, page count, truncation flag + truncated-page range if applicable.

- chunks: array of Chunk Records (Section 10.1).

- qaTurns: an ordered array of Q&A Turn records, one per question asked in the session (not a single "current" turn). Each Q&A Turn holds: turnId, questionText, and answerSentences (an array of Sentence Verification Records per Section 10.2, in strict order). Submitting a new question appends a new turn rather than overwriting the previous one; prior turns remain visible in the UI, scrolled above the active turn, so a judge asking 3-5 questions in one session (per Section 14.1's test script) can see the full history rather than losing earlier verified answers.

- mode: 'moss' \| 'baseline' — drives which retrieval path FR-7 uses.

- No field in this model is persisted beyond the browser session; a page refresh is an accepted, explicit reset of state.

11\. Latency Budget and Feasibility Analysis

11.1 Per-Stage Latency Targets

| **Stage**                              | **Target Latency**                          | **Realistic Range**                                       | **Honesty Note**                                                                             |
|----------------------------------------|---------------------------------------------|-----------------------------------------------------------|----------------------------------------------------------------------------------------------|
| Moss retrieval (FR-7)                  | \< 10-30ms                                  | 5-30ms depending on index size                            | This is the number shown live as 'retrieval latency' — labelled explicitly as such           |
| Baseline brute-force retrieval (FR-12) | N/A (intentionally slower)                  | Tens to hundreds of ms, scales with chunk count           | Must be measured live, never hardcoded                                                       |
| Verdict classification call (FR-8)     | 150-250ms                                   | 100-400ms depending on provider load                      | This is a real network LLM call; it is NOT sub-10ms and the pitch must never imply otherwise |
| Explanation call (FR-10)               | 500-1000ms, non-blocking                    | Similar to verdict call, fires after colour already shown | Never gates the colour update                                                                |
| Generation token stream                | 15-40ms between tokens (provider-dependent) | Varies significantly by model/provider                    | Determines how often new sentences arrive — see 11.2                                         |

11.2 The Central Feasibility Risk: Does the A/B Gap Actually Show Up?

This is flagged as the most important open technical risk in the entire document, and it must be validated empirically before the team invests further build time assuming FR-12 will work as described.

The concern: the verdict call (FR-8) already takes 150-250ms regardless of retrieval speed. A typical hosted LLM generates a 15-20 word sentence in roughly 2-4 seconds at conventional throughput (25-60 tokens/sec). If new sentences only arrive every 2-4 seconds, then even a 'slow' baseline pipeline (300ms retrieval + 200ms verdict, ≈500ms total) still finishes well within the gap between sentences — the verification queue would never visibly back up, and the sponsor-facing A/B toggle would fail to demonstrate anything, because both modes would appear to keep pace.

**Required validation before relying on FR-12 in the live pitch:** run both retrieval paths against real timers on the pinned demo document and confirm, empirically, that the queue visibly backs up in Baseline mode at the sentence-arrival rate the demo generation model actually produces.

**Primary mitigation (recommended):** use a fast-streaming generation provider (Gemini Flash / Flash-Lite is the provider chosen for this build, for its no-billing-required free tier -- see Section 3.2/TECH_STACK.md for current rate-limit numbers and a fallback plan) capable of several hundred tokens/sec, so that sentences complete every few hundred milliseconds rather than every few seconds. At that arrival rate, a ~500ms+ baseline pipeline is genuinely slower than sentence arrival, and the queue backlog becomes visible and honest — while Moss's sub-30ms retrieval keeps pace. This also strengthens the sponsor narrative: the choice of a fast generator is explainable as 'we chose a fast generation model specifically because slow retrieval breaks down once generation itself is fast.'

**Secondary mitigation (fallback):** scale the demo document's chunk count up so that brute-force cosine similarity itself becomes the bottleneck, independent of sentence arrival rate. This is less time-efficient for a 3-day build and is not the primary plan.

11.3 Cost Feasibility

A 20-30 sentence answer produces roughly 20-30 verdict calls and up to the same number of explanation calls (fired only for AMBER/RED sentences, typically a minority). Using the fastest/cheapest available model tier for both call shapes keeps per-demo-run cost negligible (well under the cost of a single generation call on a larger model) and keeps the system responsive enough to feel live rather than batched.

12\. Non-Functional Requirements

12.1 Performance

- UI must render streamed tokens without visible jank on a standard laptop / conference-wifi connection, since the live demo depends on this.

- Colour updates (FR-9) must appear within one rendering frame of a verdict resolving server-side — no additional client-side delay is acceptable.

- The system must sustain at least one full document (up to the configured page limit) and one multi-sentence Q&A round-trip without degradation during a live demo session.

12.2 Scalability (Explicitly Bounded for This Build)

This is a single-session, single-user, in-memory demo system. It is not designed, and is not required, to support concurrent multi-user load, horizontal scaling, or large-scale document corpora. This is a deliberate scope decision (Section 3.2), not an oversight: building for scale that will never be exercised during judging would consume build time better spent on the core verified-streaming loop. If continued past the hackathon (Section 15), scalability work — connection pooling, a real persistence layer, multi-tenant isolation — would be a first post-hackathon milestone, not a v1 requirement.

12.3 Reliability and Availability

- The deployed demo must be reachable and functional at the specific time of judging; a single Vercel deployment with no external stateful dependency beyond Moss and the LLM provider is chosen specifically to minimize moving parts that could fail under time pressure.

- Every external call (Moss, generation, verdict, explanation) has an explicit, defined failure/fallback behaviour (Section 8), so a single API hiccup during a live demo degrades gracefully (e.g., one sentence goes AMBER) rather than crashing the whole session.

12.4 Security and Privacy

- No user accounts, no authentication, and no persistent storage of uploaded documents beyond the active browser session means there is no user data retention surface to secure or disclose.

- Uploaded documents are not written to any durable database or logged in full; only in-memory processing during the active session is performed.

- API keys for Moss and the LLM provider(s) are held server-side (Next.js API routes / environment variables) and are never exposed to the client bundle.

- Because documents may be uploaded by a judge testing with their own file, no assumption is made about document content; the system does not attempt to interpret or execute any content found in the uploaded document beyond text extraction.

12.5 Accessibility

- Colour is the primary signal (GREEN/RED/AMBER/GREY); given the compressed build timeline, a stretch goal (not a v1 blocker) is to pair each colour with a small distinct icon or pattern so the signal is not colour-only for colour-blind users. Documented here as a known limitation if not completed in time (see Section 15).

12.6 Honesty and Numerical Integrity (Product-Specific NFR)

Because the product's entire premise is trustworthy verification, this document elevates 'no fabricated numbers, ever' to the level of a non-functional requirement, not merely a build guideline. Every millisecond figure, every similarity score, and every latency comparison shown anywhere in the UI must originate from a real, measured value at the time it is displayed. This applies with equal force to the sponsor-facing A/B toggle (FR-12) as to the core verification loop.

13\. Failure Modes and Fallback Matrix

Consolidated view of every failure path defined in Section 8, so that no stage of the pipeline can fail into an undefined or silently-incorrect state. This table is the single reference used during pre-demo testing to deliberately trigger and verify each fallback.

| **Stage**                               | **Failure Trigger**                                            | **Required Fallback Behaviour**                                                                                                                                                                  |
|-----------------------------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Document intake (FR-1)                  | Scanned/image PDF with no extractable text                     | Explicit on-screen message; do not proceed with an empty index                                                                                                                                   |
| Chunking/indexing (FR-2)                | Document exceeds 20 pages / ~8,000 words                       | Index content up to the first threshold reached; persistent visible truncation notice naming excluded pages                                                                                      |
| Generation (FR-4)                       | Provider timeout / error                                       | Visible specific error state; allow retry without re-upload                                                                                                                                      |
| Sentence detection (FR-5)               | Stream ends mid-sentence                                       | Flush remaining buffer as a final sentence; never drop trailing content silently                                                                                                                 |
| Trivial-claim filter (FR-6)             | Ambiguous filler-vs-claim sentence                             | Bias toward treating as checkable (send to retrieval) rather than silently skipping a real claim                                                                                                 |
| Moss retrieval (FR-7)                   | No candidate clears similarity floor                           | Skip verdict step entirely; mark AMBER ('no related passage found')                                                                                                                              |
| Verdict classification (FR-8)           | Classifier error, malformed output, or timeout                 | Default to AMBER. Never default to GREEN/SUPPORTED on any failure path                                                                                                                           |
| Explanation (FR-10)                     | Call fails or times out                                        | Keep the existing colour; simply show no explanation text                                                                                                                                        |
| A/B baseline (FR-12)                    | Gap does not appear at real sentence-arrival speed             | Do not claim a gap that isn't real; adjust generation provider per Section 11.2 rather than fake the numbers                                                                                     |
| Verdict/explanation calls (FR-8, FR-10) | Provider rate limit (429) hit under fast sentence-arrival rate | Bounded concurrency cap on in-flight calls; exponential backoff and retry; on exhausted retries, default to AMBER per FR-8’s existing never-default-to-GREEN rule rather than blocking the queue |

14\. Testing and Validation Strategy

14.1 Pre-Demo Test Script (Must Pass Before Submission)

- Pin one demo document (e.g., a real quarterly financial report PDF) and one fixed set of 3-5 questions used for every rehearsal, so verdict behaviour is reproducible.

- Confirm the sentence boundary test set (abbreviations, decimals, quotes) produces zero false splits (FR-5 acceptance criteria).

- Confirm the direction-flip and number-flip contradiction test set (at least 5 + 5 pairs) is classified CONTRADICTED, not SUPPORTED, on at least 3 separate runs, to catch classifier non-determinism (FR-8 acceptance criteria).

- Deliberately trigger each row of the Failure Mode Matrix (Section 13) at least once during rehearsal — e.g., ask a question with no supporting passage in the document to confirm AMBER, not a crash.

- Run the full pinned demo script end-to-end at least 3 times on the actual deployed (not local) environment to catch any deployment-specific latency or environment variable issues.

- Validate the A/B latency gap empirically per Section 11.2 before deciding whether FR-12 ships in the final demo.

14.2 What Is Explicitly Not Tested (Scope-Appropriate)

- Load/concurrency testing — out of scope per Section 12.2.

- Cross-browser exhaustive compatibility — a single modern browser (Chrome) target is sufficient for a judged demo.

- Long-document stress testing beyond the configured truncation limit, beyond confirming the truncation notice itself fires correctly.

15\. Risks and Mitigations

| **Risk**                                                                                                                                                                 | **Likelihood**              | **Impact**                                         | **Mitigation**                                                                                                                                                                                              |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A/B baseline gap doesn't show up live (Section 11.2)                                                                                                                     | Medium                      | High — undermines the core sponsor pitch           | Empirically validate before demo day; switch to a fast-streaming generation provider if needed                                                                                                              |
| Verdict classifier inconsistency on repeated runs of the same sentence pair                                                                                              | Medium                      | Medium — could show a false GREEN live             | Pin demo script; run each pinned Q&A pair 3-5 times pre-demo; keep AMBER as the strict default on any doubt                                                                                                 |
| Time lost to concurrent placement-drive commitments                                                                                                                      | High                        | High — could cut into build time                   | Priority order fixed in Section 16: FR-1 through FR-9 (core loop) before FR-10/11, FR-12 last and droppable                                                                                                 |
| PDF text/page-number extraction unreliable on demo document                                                                                                              | Medium                      | Medium — breaks source panel accuracy (FR-11)      | Test extraction on the actual pinned demo PDF on Day 1, not Day 3                                                                                                                                           |
| Verdict/explanation API calls hit provider rate limits under fast-generator load (Section 11.2 mitigation increases sentence-arrival rate, and therefore call frequency) | Medium                      | High — visible stall or error mid-demo             | Bounded concurrency cap on in-flight verdict/explanation calls plus exponential backoff on 429s; rehearse at the actual fast-generator sentence-arrival rate, not a slower local test rate, before demo day |
| Live API rate limits or flakiness during judged demo                                                                                                                     | Low-Medium                  | High — visible failure in front of judges          | Rehearse on deployed environment; have a pre-recorded backup video per submission requirements                                                                                                              |
| Colour-only signal excludes colour-blind users                                                                                                                           | Low priority given timeline | Low for hackathon judging, real for actual product | Documented as known limitation (Section 12.5); icon-pairing as stretch goal                                                                                                                                 |

16\. Build Timeline (3-Day / 72-Hour Window)

This schedule assumes a solo builder with concurrent academic placement-drive obligations. Priority order is fixed and non-negotiable: the core verified-streaming loop (FR-1 through FR-9) must work end-to-end before any time is spent on FR-10 through FR-12.

Day 0 (before build hours begin) — Feasibility Spike

- Run the empirical A/B latency validation from Section 11.2 against real timers using a placeholder document. This decides the generation model/provider choice before any UI work begins, since reversing this decision later is expensive.

Day 1 — Ingestion and Core Retrieval

- FR-1 (document intake), FR-2 (chunking + Moss indexing), FR-3 (question input), FR-4 (streaming generation) working end-to-end, even without verification yet.

- Test PDF text and page-number extraction on the actual pinned demo document (Risk table, Section 15).

Day 2 — The Core Verified-Streaming Loop (Non-Negotiable Core)

- FR-5 (sentence boundary detection) with the abbreviation/decimal test set passing.

- FR-6 (trivial-claim filter), FR-7 (Moss retrieval), FR-8 (verdict classification) with the direction-flip/number-flip contradiction test set passing.

- FR-9 (live colour UI + running latency counter) wired end-to-end. At the end of Day 2, the core loop (FR-1-FR-9) must be demoable even if nothing past this point gets built.

Day 3 — Polish, Sponsor Feature, and Submission Package

- FR-10 (explanation), FR-11 (source panel), then FR-12 (A/B toggle) in that priority order — drop whichever doesn't fit, in reverse order, if time runs out.

- Deploy to Vercel; run the full pre-demo test script (Section 14.1) against the deployed environment, not just locally.

- Record backup demo video, finalize architecture diagram (matching Section 9.1), and assemble the submission package (Section 17).

17\. Submission Checklist and Judging Alignment

17.1 Required Submission Artifacts

- This PRD (final, locked version).

- Architecture diagram matching Section 9.1 exactly.

- GitHub repository, public, with a README covering setup and the same problem framing as Section 2.

- Deployed link (Vercel) that is live and functional at judging time.

- Video demo walking through the worked example in Section 18, including the A/B toggle if it shipped.

17.2 Explicit Mapping to Likely Judging Criteria

| **Likely Judging Criterion**                          | **How This PRD / Build Addresses It**                                                                                               |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Genuine, non-trivial use of sponsor technology (Moss) | Section 2.4 and Section 11 make the dependency falsifiable and demonstrate it live via a real baseline, not an assertion            |
| Technical depth / non-obvious problem solved          | Section 2.3 identifies and designs around the similarity-is-not-truth failure mode, which most naive implementations miss           |
| Feasibility within the build window                   | Section 16 gives a fixed, priority-ordered 3-day schedule with a non-negotiable core loop and explicitly droppable stretch features |
| Honesty / rigor                                       | Section 12.6 elevates 'no fabricated numbers' to a non-functional requirement; Section 13 defines a fallback for every failure path |
| Real-world applicability beyond the hackathon         | Section 4.2 and Section 19 (Future Work) frame the product beyond the demo, without overclaiming v1 scope                           |

18\. Worked Example (Reference Demo Script)

This is the target behaviour used to validate the build and to script the video demo. It should be reproduced, near-verbatim, against the pinned demo document before submission.

Scenario: a judge uploads a Q3 financial report PDF and asks, “Summarise the financial highlights.”

- “The company had a strong quarter.” → filtered as opinion (FR-6) → GREY, no Moss call spent.

- “Revenue increased 10% to \$45 million in Q3.” → Moss finds the matching source passage in roughly 9ms → verdict check confirms the number and direction match → GREEN.

- “Operating costs decreased significantly, down 30% from last year.” → Moss finds a topically related passage that actually states costs rose 8% → verdict check catches both the direction and number mismatch → RED → explanation appears about 0.8 seconds later: “Source states costs rose 8% due to hiring; this sentence claims a 30% decrease.”

- Judge clicks the red sentence → source panel shows the exact page 4 passage, matching FR-11.

- Judge flips the A/B toggle → same question re-run → baseline retrieval takes roughly 200ms+ per sentence instead of roughly 9ms → verification visibly falls behind the streaming text, per the validated behaviour in Section 11.2.

19\. Open Questions and Future Work (Post-Hackathon)

These are explicitly not v1 commitments; they are recorded so that scope decisions in Section 3.2 are understood as deliberate deferrals, not oversights, should this project continue past the hackathon.

- Multi-document and cross-document verification, including conflicting claims across sources.

- User accounts and persistent verification history, enabling a team or organizational audit trail.

- A proper evaluation harness with a human-labeled ground-truth set to report defensible accuracy, precision, and false-negative rate numbers (Section 5.2) rather than a pinned demo script.

- Colour-blind-accessible signal design (icon pairing, not colour alone) promoted from stretch goal to committed requirement.

- OCR support for scanned/image-only PDFs.

- Support for live/streaming source documents (e.g., a document being edited concurrently) rather than a static snapshot.

- Evaluation of whether a fine-tuned small classifier could replace the general-purpose LLM verdict call (FR-8) at lower cost and lower latency once accuracy requirements are established via the evaluation harness above.

20\. Glossary

| **Term**                             | **Definition**                                                                                                                                                                                                         |
|--------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Grounding / groundedness             | The property of a generated statement being verifiably supported by a specific source document, as opposed to fabricated or unsupported                                                                                |
| Hallucination                        | A generated statement that is unsupported by, or contradicts, the source material it claims to be based on                                                                                                             |
| Retrieval                            | The step of finding the source passage(s) most semantically related to a given piece of text (here: a generated sentence)                                                                                              |
| Verdict / entailment classification  | The separate step of judging whether a retrieved passage actually supports, contradicts, or is unrelated to a claim — distinct from retrieval (Section 2.3, FR-8)                                                      |
| RAG (Retrieval-Augmented Generation) | An architecture where an LLM's generation is conditioned on passages retrieved from an external document store                                                                                                         |
| p95 latency                          | The latency value below which 95% of measured requests fall; a standard way of reporting “worst common case” rather than average performance                                                                           |
| Brute-force cosine similarity        | A similarity search computed by directly comparing a query vector against every stored vector, without an index structure — simple, always exact, but slow at scale; used here deliberately as a real, honest baseline |
