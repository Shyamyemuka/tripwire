# Tripwire

**Real-Time, Sentence-Level Hallucination Detection for Streaming LLM Output**

Tripwire is an inline verification and safety engine designed to intercept streaming Large Language Model (LLM) responses and verify each factual claim against a source document in real time. Rather than relying on post-generation evaluation frameworks, Tripwire fact-checks sentence by sentence as tokens stream, rendering immediate visual verdicts before incorrect statements can lead to cognitive anchoring or costly downstream errors.

---

## Overview

Traditional Retrieval-Augmented Generation (RAG) evaluators and guardrails (e.g., Guardrails AI, Ragas, TruLens) operate strictly post-hoc. Because conventional vector databases incur search latencies between 150ms and 500ms—far exceeding the typical 20ms to 40ms inter-token cadence of modern streaming models—real-time inline verification has historically been technically unfeasible.

Tripwire leverages **Moss's sub-10ms semantic retrieval engine** to eliminate this bottleneck. By pairing ultra-low latency index querying with an asynchronous sentence boundary detector, Tripwire retrieves relevant source passages and computes rigorous factual verdicts concurrently with token generation.

```
[Uploaded Document] ──> Chunking & Extraction ──> Moss Index (Sub-10ms)
                                                        │
[User Query] ──> Streaming LLM (Tokens)                  │ Per-Sentence
                       │                                │ Candidate Query
                       ▼                                ▼
            [Sentence Boundary Detector] ──> [NLI Verdict Classifier]
                       │                                │
                       ▼                                ▼
            [Live Stream UI] <── Precision Color Coding (Green / Red / Amber / Grey)
```

---

## Core Principles & Pipeline Invariants

Tripwire is engineered around five non-negotiable correctness principles:

1. **Similarity Is Not Truth**: Vector distance alone cannot establish factual truth. A sentence asserting *"operating expenses dropped 18%"* shares nearly all semantic tokens with a source passage reading *"operating expenses rose 18%"*, scoring exceptionally high similarity against the exact claim it contradicts. Tripwire uses vector retrieval exclusively for candidate discovery, routing candidates to an explicit natural language inference (NLI) classification stage that strictly audits directional verbs, quantities, dates, and negations.
2. **Independent Per-Sentence Queries**: Verification never reuses the generation prompt's bundled context window. Every completed sentence issues its own fresh, isolated retrieval query against the entire source document. This ensures detection of external hallucinations and model drift into topics unaddressed by the source text.
3. **Fail-Safe Default (Never False Positive)**: Under any failure state—including network timeouts, upstream rate limits, or ambiguous source coverage—the verification verdict unconditionally resolves to **Amber** (`UNVERIFIABLE`). An unverified claim is never reported as verified (**Green**).
4. **Authentic Clock Telemetry**: Every latency metric presented in the interface is captured via high-resolution `performance.now()` clocks around the actual execution path. Baseline comparisons execute an authentic, un-mocked brute-force cosine similarity loop to provide rigorous empirical benchmarks.
5. **Ordered Progressive Rendering**: Although retrieval and verdict classification calls execute asynchronously, verdicts are revealed strictly in sequential reading order. A subsequent sentence is never colored before prior sentences have resolved.

---

## Key Features

- **Inline Sentence Boundary Detection**: A client-side streaming tokenizer identifies grammatical and syntactic sentence terminations in real time as tokens arrive.
- **Sub-10ms Semantic Retrieval Layer**: Direct integration with `@moss-dev/moss` enables instant extraction of candidate passages across thousands of document tokens.
- **Four-Tier Precision Verdict Classification**:
  - **Green (Supported)**: Claim is directly affirmed by the source document.
  - **Red (Contradicted)**: Claim directly contradicts numbers, directions, dates, or assertions in the source passage.
  - **Amber (Unverifiable)**: Passage is ambiguous, topically disjoint, or verification timed out (safe default).
  - **Grey (Non-Factual)**: Syntactic greetings, opinions, and rhetorical transition statements filtered automatically.
- **Deep Source Inspection Drawer**: Clicking any sentence reveals the corresponding source snippet, exact document page number, character offsets, and automated contradiction reasoning.
- **Authentic A/B Latency Comparison**: An interactive mode switch permits toggling between the optimized Moss retrieval pipeline and an in-memory brute-force cosine similarity baseline, displaying real-time microsecond-level retrieval delta.
- **Multi-Key Failover & Resilient Generation**: Upstream LLM orchestration incorporates automatic key rotation, model fallback, and request pacing to prevent disruption from transient provider availability spikes.
- **Zero-Backend Client Persistence**: Full session and audit history are cached locally in IndexedDB without external database overhead.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | High-performance server-rendered and API execution |
| **Runtime** | Node.js 20+ / TypeScript 5 | Type-safe backend routes and component architecture |
| **Frontend UI** | React 19, Tailwind CSS v4, Lucide | Modern tactile dark-mode interface with streaming typography |
| **Retrieval Engine** | `@moss-dev/moss` | Dedicated sub-10ms vector indexing and query execution |
| **Language Models** | Google Gemini (`@google/genai`) | Whole-document stuffed generation, verdict classification, and explanation |
| **Document Intake** | `pdf-parse` & UTF-8 Text Extractors | Fast client/server parsing of multi-page PDF, TXT, and Markdown files |
| **Client Storage** | IndexedDB (`lib/storage.ts`) | Zero-footprint local audit logging and session persistence |

---

## Project Structure

```
tripwire/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── explain/route.ts      # Asynchronous mismatch explanation endpoint
│   │   │   ├── generate/route.ts     # SSE streaming answer generation route
│   │   │   ├── session/route.ts      # Document ingestion and Moss indexing route
│   │   │   └── verify/route.ts       # Per-sentence retrieval and verdict classification
│   │   ├── agent/page.tsx            # Primary verification workspace and state machine
│   │   ├── globals.css               # Design tokens, keyframe animations, and custom styling
│   │   ├── layout.tsx                # Application root layout and metadata configuration
│   │   └── page.tsx                  # Application entry point
│   ├── components/
│   │   ├── ChatHistorySidebar.tsx    # IndexedDB conversation and session management drawer
│   │   ├── CinematicLanding.tsx      # Interactive product briefing and onboarding screen
│   │   ├── QAThread.tsx              # Streaming conversation thread with live precision highlights
│   │   ├── QuestionInput.tsx         # Tactile input controller with submission safeguards
│   │   ├── SourcePanel.tsx           # Slide-over citation drawer with passage diff analysis
│   │   ├── TopBar.tsx                # Telemetry header, latency metrics, and A/B mode toggle
│   │   └── UploadScreen.tsx          # Multi-format document intake with indexing progress indicator
│   └── lib/
│       ├── baseline.ts               # Un-mocked brute-force cosine baseline comparison engine
│       ├── chunking.ts               # Overlapping window chunker with character and page offsets
│       ├── gemini.ts                 # Resilient multi-key LLM client with failover & backoff
│       ├── moss.ts                   # Moss SDK integration, index lifecycle, and query client
│       ├── sample-doc.ts             # Embedded reference financial disclosure for instant benchmarking
│       ├── sentence-boundary.ts      # Stream-safe incremental sentence boundary detector
│       ├── storage.ts                # Client-side IndexedDB persistence adapter
│       ├── trivial-filter.ts         # Fast-path non-factual claim filter
│       └── types.ts                  # Core TypeScript domain definitions and schema contracts
├── docs/
│   ├── PRD.md                        # Formal Product Requirements Document (v1.1)
│   ├── APP_FLOW.md                   # Complete user flow and UI state machine documentation
│   └── TECH_STACK.md                 # Architecture rationale and dependency validation records
├── skills/
│   └── tripwire-pipeline/SKILL.md    # Pipeline invariant governance specifications
└── package.json                      # Pinned dependencies and operational build scripts
```

---

## Getting Started

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **npm** or **pnpm**
- **Google Gemini API Key**: Acquired via [Google AI Studio](https://aistudio.google.com/)
- **Moss Project Credentials**: Acquired via [Moss](https://moss.dev/)

### Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

Populate the configuration parameters:

```env
# Google Gemini API Keys (Multi-key failover supported)
GEMINI_API_KEY_1=your_primary_gemini_api_key
GEMINI_API_KEY_2=your_secondary_gemini_api_key

# Models
GEMINI_GENERATION_MODEL=gemini-3.6-flash
GEMINI_VERDICT_MODEL=gemini-3.1-flash-lite
GEMINI_EXPLANATION_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

# Moss Retrieval Credentials
MOSS_PROJECT_ID=your_moss_project_id
MOSS_PROJECT_KEY=your_moss_project_key

# Optional: Baseline Embedding Key (used solely for FR-12 brute-force comparison)
EMBEDDING_API_KEY=your_embedding_api_key
```

### Installation & Execution

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000).

3. **Produce an optimized production build:**
   ```bash
   npm run build
   npm run start
   ```

4. **Codebase quality checks:**
   ```bash
   npm run lint
   npx tsc --noEmit
   ```

---

## Verification & Benchmarks

Tripwire includes built-in verification routines to validate pipeline compliance against known contradiction benchmarks:

- **Numerical Inversion Test**: Validates that conflicting numerical statistics (e.g., source: *"\$45M"* vs. generated: *"\$30M"*) reliably trigger **Red** verdicts regardless of high semantic similarity.
- **Directional Flip Test**: Validates that antithetical polarity (e.g., source: *"expanded"* vs. generated: *"contracted"*) is identified as a contradiction.
- **Unverifiable Extrapolation Test**: Confirms that claims introducing out-of-document entities cleanly resolve to **Amber** without false positives.

---

## License

This project is licensed under the Apache 2.0 License.
