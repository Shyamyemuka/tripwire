# DEMO_SCRIPT — Tripwire

This is the exact sequence to rehearse and record. Rehearse it at Gemini's actual streaming speed (per `docs/TECH_STACK.md`'s free-tier rate limits) — not a slower pace you imagine in your head — because that's the speed it will run at when a judge clicks it too.

## Pre-demo setup (do this before hitting record, every time)

1. Pin one real document — the same one every rehearsal, so you know its exact contents cold. A quarterly-style report or similar with clear factual claims (numbers, dates, directional statements) works best.
2. Confirm the document is under the 20-page / ~8,000-word cap (FR-2) so it indexes without truncation for this run.
3. Refresh the deployed link fresh (not a cached tab) — you want to demo what a judge will actually load.
4. Have the Moss/Baseline toggle set to **Moss** to start.

## Beat 1 — The empty state and the pitch (10–15 seconds)

Upload the document. While it indexes, say the one-line pitch out loud: *"As this answer streams, every sentence gets fact-checked against the source in real time — not after the fact, which is what every existing tool does."*

## Beat 2 — Ask a real question, let a GREEN sentence resolve

Ask something the document genuinely supports (e.g., "Summarise the financial highlights" against a report with a real revenue figure). Narrate what's happening as it happens, don't wait until it's done: *"Watch — that sentence just turned green in [X]ms. That's Moss finding the source passage, and a fast verdict check confirming the numbers actually match, not just the topic."*

## Beat 3 — Ask a question that surfaces a RED sentence

This is the moment the whole product exists for. Use a question or document section you know, from rehearsal, produces a genuine contradiction (a flipped direction word or changed number against the source). When it turns red: *"This is the failure mode every other tool misses — that sentence is topically similar to the source, so a naive similarity check would call it verified. Ours doesn't, because similarity isn't truth."* Click the sentence, show the source panel with the actual contradicting passage and page number.

## Beat 4 — The A/B toggle (the sponsor-facing moment)

Flip to **Baseline**. Ask a similar question. Point at the latency readout: *"Same pipeline, same document — the only thing that changed is retrieval. Watch the gap."* Let the verification visibly lag behind the streaming text before flipping back to Moss.

## Beat 5 — Close on the honest framing

*"This only works because Moss's retrieval is fast enough to run inside the stream instead of after it finishes. That's the whole bet."*

## Things to explicitly avoid saying

- Do not claim the verdict/explanation calls are sub-10ms — only retrieval is (per PRD Section 11's honesty requirement). Say "retrieval in single-digit milliseconds, verdict classification in roughly [your measured real number]ms" if asked to break it down.
- Do not claim the A/B gap if it doesn't actually show up on your specific document size — see PRD Section 15's named risk. If the gap is small, say so and explain why (small document, few chunks) rather than oversell it.

## Backup plan

Record this whole script once as a clean video **before** the live/judged moment, per the hackathon's own required "Video Demo" deliverable (see `docs/SUBMISSION_CHECKLIST.md`) — so a live glitch during actual judging never costs you the only record of the product working.
