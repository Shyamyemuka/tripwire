"use client";

import React, { useState } from 'react';
import { UploadScreen } from '@/components/UploadScreen';
import { TopBar } from '@/components/TopBar';
import { QAThread } from '@/components/QAThread';
import { QuestionInput } from '@/components/QuestionInput';
import { SourcePanel } from '@/components/SourcePanel';
import { SentenceDetector } from '@/lib/sentence-boundary';
import {
  DocumentMeta,
  ChunkRecord,
  QATurn,
  RetrievalMode,
  SentenceVerificationRecord
} from '@/lib/types';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null>(null);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [documentFullText, setDocumentFullText] = useState<string>('');

  const [qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [mode, setMode] = useState<RetrievalMode>('moss');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const [selectedSentence, setSelectedSentence] = useState<SentenceVerificationRecord | null>(null);

  // Measured cumulative metrics across entire session
  const [totalClaimsVerified, setTotalClaimsVerified] = useState<number>(0);
  const [totalRetrievalLatencyMs, setTotalRetrievalLatencyMs] = useState<number>(0);
  const [lastRetrievalLatencyMs, setLastRetrievalLatencyMs] = useState<number | null>(null);

  const handleDocumentLoaded = (data: {
    sessionId: string;
    documentMeta: DocumentMeta;
    chunks: ChunkRecord[];
    documentFullText: string;
  }) => {
    setSessionId(data.sessionId);
    setDocumentMeta(data.documentMeta);
    setChunks(data.chunks);
    setDocumentFullText(data.documentFullText);
    setQaTurns([]);
    setTotalClaimsVerified(0);
    setTotalRetrievalLatencyMs(0);
    setLastRetrievalLatencyMs(null);
  };

  const handleResetDocument = () => {
    setSessionId(null);
    setDocumentMeta(null);
    setChunks([]);
    setDocumentFullText('');
    setQaTurns([]);
    setSelectedSentence(null);
  };

  const handleToggleMode = (newMode: RetrievalMode) => {
    setMode(newMode);
  };

  const handleRunBenchmark = () => {
    handleSubmitQuestion("Run full factual audit: Compare revenue growth, operating expenses, and future expansion plans.");
  };

  // Submit a question and stream response with inline sentence verification
  const handleSubmitQuestion = async (questionText: string) => {
    if (!sessionId || !documentFullText || isStreaming) return;

    const turnId = `turn-${Date.now()}`;
    const activeMode = mode; // Fixed mode for this turn (FR-12)

    const newTurn: QATurn = {
      turnId,
      questionText,
      mode: activeMode,
      answerSentences: [],
      isStreaming: true,
      error: null
    };

    setQaTurns((prev) => [...prev, newTurn]);
    setIsStreaming(true);

    const detector = new SentenceDetector();

    // Helper to dispatch async verification for a completed sentence
    const verifySentence = async (sId: string, sText: string) => {
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence: sText,
            sessionId,
            mode: activeMode,
            chunks // passed for baseline in-memory scan
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Verification failed');
        }

        // Update sentence record in this turn
        setQaTurns((prev) =>
          prev.map((t) => {
            if (t.turnId !== turnId) return t;
            return {
              ...t,
              answerSentences: t.answerSentences.map((s) => {
                if (s.sentenceId !== sId) return s;
                return {
                  ...s,
                  status: data.status,
                  matchedChunkId: data.matchedChunkId,
                  matchedChunkText: data.matchedChunkText,
                  topCandidates: data.topCandidates,
                  similarityScore: data.similarityScore,
                  retrievalLatencyMs: data.retrievalLatencyMs,
                  verdictLatencyMs: data.verdictLatencyMs
                };
              })
            };
          })
        );

        // Update live metrics (FR-9)
        if (data.status !== 'GREY') {
          setTotalClaimsVerified((c) => c + 1);
          setTotalRetrievalLatencyMs((tot) => tot + data.retrievalLatencyMs);
          setLastRetrievalLatencyMs(data.retrievalLatencyMs);
        }

        // FR-10: Asynchronous non-blocking explanation for RED or AMBER
        if (data.status === 'RED' || data.status === 'AMBER') {
          if (data.matchedChunkText) {
            fetch('/api/explain', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sentence: sText,
                matchedPassageText: data.matchedChunkText,
                status: data.status
              })
            })
              .then((r) => r.json())
              .then((explData) => {
                if (explData.explanation) {
                  setQaTurns((prev) =>
                    prev.map((t) => {
                      if (t.turnId !== turnId) return t;
                      return {
                        ...t,
                        answerSentences: t.answerSentences.map((s) => {
                          if (s.sentenceId !== sId) return s;
                          return {
                            ...s,
                            explanation: explData.explanation,
                            isExplained: true
                          };
                        })
                      };
                    })
                  );
                }
              })
              .catch((err) => console.error('Error fetching explanation:', err));
          }
        }
      } catch (err) {
        console.error('Sentence verification error:', err);
        // Invariant 3: Fallback NEVER defaults to GREEN
        setQaTurns((prev) =>
          prev.map((t) => {
            if (t.turnId !== turnId) return t;
            return {
              ...t,
              answerSentences: t.answerSentences.map((s) => {
                if (s.sentenceId !== sId) return s;
                return {
                  ...s,
                  status: 'AMBER',
                  retrievalLatencyMs: 0,
                  verdictLatencyMs: 0
                };
              })
            };
          })
        );
      }
    };

    let sentenceCounter = 0;

    const appendSentence = (text: string) => {
      const sentenceId = `${turnId}-s-${sentenceCounter++}`;
      const record: SentenceVerificationRecord = {
        sentenceId,
        text,
        status: 'PENDING',
        matchedChunkId: null,
        matchedChunkText: null,
        similarityScore: null,
        retrievalLatencyMs: 0,
        verdictLatencyMs: null,
        explanation: null
      };

      setQaTurns((prev) =>
        prev.map((t) => {
          if (t.turnId !== turnId) return t;
          return {
            ...t,
            answerSentences: [...t.answerSentences, record]
          };
        })
      );

      // Dispatch verification
      verifySentence(sentenceId, text);
    };

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          documentText: documentFullText
        })
      });

      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generation failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            let payload: { token?: string; done?: boolean; error?: string };
            try {
              payload = JSON.parse(raw);
            } catch {
              // Ignore partial JSON chunks
              continue;
            }

            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.token) {
              const completedSentences = detector.addToken(payload.token);
              for (const s of completedSentences) {
                appendSentence(s);
              }
            }
            if (payload.done) {
              break;
            }
          }
        }
      }

      // Flush trailing buffer
      const finalSentences = detector.flush();
      for (const s of finalSentences) {
        appendSentence(s);
      }
    } catch (err: unknown) {
      console.error('Generation stream error:', err);
      const msg = err instanceof Error ? err.message : 'Generation stream encountered an error.';
      setQaTurns((prev) =>
        prev.map((t) => {
          if (t.turnId !== turnId) return t;
          return {
            ...t,
            error: msg
          };
        })
      );
    } finally {
      setIsStreaming(false);
      setQaTurns((prev) =>
        prev.map((t) => {
          if (t.turnId !== turnId) return t;
          return { ...t, isStreaming: false };
        })
      );
    }
  };

  const avgRetrievalLatencyMs =
    totalClaimsVerified > 0 ? totalRetrievalLatencyMs / totalClaimsVerified : 0;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {!documentMeta ? (
        <UploadScreen onDocumentLoaded={handleDocumentLoaded} />
      ) : (
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar
            documentMeta={documentMeta}
            mode={mode}
            onToggleMode={handleToggleMode}
            lastRetrievalLatencyMs={lastRetrievalLatencyMs}
            totalClaimsVerified={totalClaimsVerified}
            avgRetrievalLatencyMs={avgRetrievalLatencyMs}
            onResetDocument={handleResetDocument}
            onRunBenchmark={handleRunBenchmark}
          />

          <main className="flex-1 flex flex-col justify-between">
            <QAThread
              qaTurns={qaTurns}
              onSelectSentence={(s) => setSelectedSentence(s)}
              selectedSentenceId={selectedSentence?.sentenceId || null}
            />

            <QuestionInput
              onSubmitQuestion={handleSubmitQuestion}
              isStreaming={isStreaming}
            />
          </main>

          {/* Slide-over Source Panel */}
          {selectedSentence && (
            <SourcePanel
              sentenceRecord={selectedSentence}
              onClose={() => setSelectedSentence(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}