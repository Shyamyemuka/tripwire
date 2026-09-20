"use client";

import React, { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadScreen } from "@/components/UploadScreen";
import { TopBar } from "@/components/TopBar";
import { QAThread } from "@/components/QAThread";
import { QuestionInput } from "@/components/QuestionInput";
import { SourcePanel } from "@/components/SourcePanel";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { SentenceDetector } from "@/lib/sentence-boundary";
import {
  saveConversation,
  getConversation,
  StoredConversation,
} from "@/lib/storage";
import {
  DocumentMeta,
  ChunkRecord,
  QATurn,
  RetrievalMode,
  SentenceVerificationRecord,
} from "@/lib/types";

function AgentWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationIdParam = searchParams.get("c");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null>(null);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [documentFullText, setDocumentFullText] = useState<string>("");

  const [qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [mode, setMode] = useState<RetrievalMode>("moss");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const [selectedSentence, setSelectedSentence] =
    useState<SentenceVerificationRecord | null>(null);

  // Measured cumulative metrics across entire session (Invariant 4: real clock metrics)
  const [totalClaimsVerified, setTotalClaimsVerified] = useState<number>(0);
  const [totalRetrievalLatencyMs, setTotalRetrievalLatencyMs] = useState<number>(0);
  const [lastRetrievalLatencyMs, setLastRetrievalLatencyMs] = useState<number | null>(null);

  // Track active session data with a ref for reliable autosave during async streaming
  const sessionRef = useRef<{
    sessionId: string | null;
    documentMeta: DocumentMeta | null;
    documentFullText: string;
    chunks: ChunkRecord[];
    qaTurns: QATurn[];
    mode: RetrievalMode;
    totalClaimsVerified: number;
    totalRetrievalLatencyMs: number;
    lastRetrievalLatencyMs: number | null;
  }>({
    sessionId: null,
    documentMeta: null,
    documentFullText: "",
    chunks: [],
    qaTurns: [],
    mode: "moss",
    totalClaimsVerified: 0,
    totalRetrievalLatencyMs: 0,
    lastRetrievalLatencyMs: null,
  });

  useEffect(() => {
    sessionRef.current = {
      sessionId,
      documentMeta,
      documentFullText,
      chunks,
      qaTurns,
      mode,
      totalClaimsVerified,
      totalRetrievalLatencyMs,
      lastRetrievalLatencyMs,
    };
  }, [
    sessionId,
    documentMeta,
    documentFullText,
    chunks,
    qaTurns,
    mode,
    totalClaimsVerified,
    totalRetrievalLatencyMs,
    lastRetrievalLatencyMs,
  ]);

  // Persist current session snapshot to IndexedDB
  const persistSession = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur.sessionId || !cur.documentMeta) return;

    const stored: StoredConversation = {
      id: cur.sessionId,
      title: cur.documentMeta.filename || "Untitled Document",
      filename: cur.documentMeta.filename || "Document",
      documentFullText: cur.documentFullText,
      documentMeta: cur.documentMeta,
      chunks: cur.chunks,
      qaTurns: cur.qaTurns,
      mode: cur.mode,
      totalClaimsVerified: cur.totalClaimsVerified,
      totalRetrievalLatencyMs: cur.totalRetrievalLatencyMs,
      lastRetrievalLatencyMs: cur.lastRetrievalLatencyMs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveConversation(stored);
  }, []);

  // Restore conversation from IndexedDB if ?c= parameter is provided
  useEffect(() => {
    if (conversationIdParam && conversationIdParam !== sessionId) {
      getConversation(conversationIdParam).then((conv) => {
        if (conv) {
          setSessionId(conv.id);
          setDocumentMeta(conv.documentMeta);
          setChunks(conv.chunks);
          setDocumentFullText(conv.documentFullText);
          setQaTurns(conv.qaTurns || []);
          setMode(conv.mode || "moss");
          setTotalClaimsVerified(conv.totalClaimsVerified || 0);
          setTotalRetrievalLatencyMs(conv.totalRetrievalLatencyMs || 0);
          setLastRetrievalLatencyMs(conv.lastRetrievalLatencyMs ?? null);
        }
      });
    }
  }, [conversationIdParam, sessionId]);

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

    // Update URL query parameter
    window.history.pushState(null, "", `/agent?c=${encodeURIComponent(data.sessionId)}`);

    // Auto-save initial session to IndexedDB
    saveConversation({
      id: data.sessionId,
      title: data.documentMeta.filename || "Untitled Document",
      filename: data.documentMeta.filename || "Document",
      documentFullText: data.documentFullText,
      documentMeta: data.documentMeta,
      chunks: data.chunks,
      qaTurns: [],
      mode: "moss",
      totalClaimsVerified: 0,
      totalRetrievalLatencyMs: 0,
      lastRetrievalLatencyMs: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const handleSelectConversation = async (id: string) => {
    const conv = await getConversation(id);
    if (conv) {
      setSessionId(conv.id);
      setDocumentMeta(conv.documentMeta);
      setChunks(conv.chunks);
      setDocumentFullText(conv.documentFullText);
      setQaTurns(conv.qaTurns || []);
      setMode(conv.mode || "moss");
      setTotalClaimsVerified(conv.totalClaimsVerified || 0);
      setTotalRetrievalLatencyMs(conv.totalRetrievalLatencyMs || 0);
      setLastRetrievalLatencyMs(conv.lastRetrievalLatencyMs ?? null);
      setSelectedSentence(null);

      window.history.pushState(null, "", `/agent?c=${encodeURIComponent(conv.id)}`);
    }
  };

  const handleResetDocument = () => {
    setSessionId(null);
    setDocumentMeta(null);
    setChunks([]);
    setDocumentFullText("");
    setQaTurns([]);
    setSelectedSentence(null);

    window.history.pushState(null, "", "/agent");
  };

  const handleToggleMode = (newMode: RetrievalMode) => {
    setMode(newMode);
  };

  // Execution engine for Q&A with inline sentence verification
  const executeQuestion = useCallback(
    async (
      questionText: string,
      activeSessionId: string,
      activeDocText: string,
      activeChunks: ChunkRecord[]
    ) => {
      const turnId = `turn-${Date.now()}`;
      const activeMode = mode; // Fixed mode for this turn (FR-12)

      const newTurn: QATurn = {
        turnId,
        questionText,
        mode: activeMode,
        answerSentences: [],
        isStreaming: true,
        error: null,
      };

      setQaTurns((prev) => [...prev, newTurn]);
      setIsStreaming(true);

      const detector = new SentenceDetector();

      // Bounded concurrency queue (concurrency = 2) to prevent browser HTTP connection pool saturation and Gemini RPM limits
      const verificationQueue: Array<{ sId: string; sText: string }> = [];
      let activeVerifications = 0;
      const MAX_CONCURRENT_VERIFICATIONS = 2;

      // Invariant 2: Each sentence issues its own fresh independent query
      const verifySentence = async (sId: string, sText: string, retryCount = 0): Promise<void> => {
        try {
          const res = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sentence: sText,
              sessionId: activeSessionId,
              mode: activeMode,
              chunks: activeChunks, // passed for baseline in-memory scan
              turnId,
              sentenceId: sId,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Verification request failed");
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
                    verdictLatencyMs: data.verdictLatencyMs,
                  };
                }),
              };
            })
          );

          // Update cumulative metrics (FR-9)
          if (data.status !== "GREY") {
            setTotalClaimsVerified((c) => c + 1);
            setTotalRetrievalLatencyMs((tot) => tot + data.retrievalLatencyMs);
            setLastRetrievalLatencyMs(data.retrievalLatencyMs);
          }

          // FR-10: Non-blocking asynchronous explanation for RED or AMBER claims
          if (data.status === "RED" || data.status === "AMBER") {
            if (data.matchedChunkText) {
              fetch("/api/explain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sentence: sText,
                  matchedPassageText: data.matchedChunkText,
                  status: data.status,
                  turnId,
                  sentenceId: sId,
                }),
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
                              isExplained: true,
                            };
                          }),
                        };
                      })
                    );
                  }
                })
                .catch(() => {
                  // Non-blocking explanation failure, silently ignored per FR-10
                });
            }
          }
        } catch (err) {
          // If network connection hiccup occurred, retry once before failing
          if (retryCount < 1) {
            await new Promise((r) => setTimeout(r, 600));
            return verifySentence(sId, sText, retryCount + 1);
          }

          console.warn("Sentence verification error (defaulting to AMBER per Invariant 3):", err);
          // Invariant 3: On error/timeout, default to AMBER. Never GREEN.
          setQaTurns((prev) =>
            prev.map((t) => {
              if (t.turnId !== turnId) return t;
              return {
                ...t,
                answerSentences: t.answerSentences.map((s) => {
                  if (s.sentenceId !== sId) return s;
                  return {
                    ...s,
                    status: "AMBER",
                    retrievalLatencyMs: 0,
                    verdictLatencyMs: 0,
                  };
                }),
              };
            })
          );
        }
      };

      const processQueue = () => {
        while (activeVerifications < MAX_CONCURRENT_VERIFICATIONS && verificationQueue.length > 0) {
          const item = verificationQueue.shift();
          if (!item) break;
          activeVerifications++;
          verifySentence(item.sId, item.sText).finally(() => {
            activeVerifications--;
            processQueue();
          });
        }
      };

      const enqueueVerification = (sId: string, sText: string) => {
        verificationQueue.push({ sId, sText });
        processQueue();
      };

      let sentenceCounter = 0;

      const appendSentence = (text: string) => {
        // Strip leading/trailing decorative symbols or em dashes
        const cleanText = text.replace(/^[\s—–\-*•#]+/, '').replace(/[\s—–\-]+$/, '').trim();
        const letters = cleanText.replace(/[^a-zA-Z]/g, '');
        if (letters.length < 2) {
          // Do not verify decorative em dashes, bullet characters, or standalone numbers as claims
          return;
        }

        const sentenceId = `${turnId}-s-${sentenceCounter++}`;
        const record: SentenceVerificationRecord = {
          sentenceId,
          text: cleanText,
          status: "PENDING",
          matchedChunkId: null,
          matchedChunkText: null,
          similarityScore: null,
          retrievalLatencyMs: 0,
          verdictLatencyMs: null,
          explanation: null,
        };

        setQaTurns((prev) =>
          prev.map((t) => {
            if (t.turnId !== turnId) return t;
            return {
              ...t,
              answerSentences: [...t.answerSentences, record],
            };
          })
        );

        // Dispatch async verification via bounded concurrency queue
        enqueueVerification(sentenceId, cleanText);
      };

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: questionText,
            documentText: activeDocText,
            sessionId: activeSessionId,
            turnId,
          }),
        });

        if (!res.ok || !res.body) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Generation request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (!raw) continue;
              let payload: { token?: string; done?: boolean; error?: string };
              try {
                payload = JSON.parse(raw);
              } catch {
                continue;
              }

              if (payload.error) {
                let friendlyMsg = payload.error;
                try {
                  const parsed = JSON.parse(payload.error);
                  if (parsed?.error?.message) {
                    friendlyMsg = parsed.error.message;
                  }
                } catch {
                  // already plain string
                }
                if (
                  friendlyMsg.includes("503") ||
                  friendlyMsg.includes("high demand") ||
                  friendlyMsg.includes("UNAVAILABLE")
                ) {
                  friendlyMsg = "The AI model is experiencing a temporary demand spike. Please try again in a moment.";
                }
                throw new Error(friendlyMsg);
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
        console.error("Generation stream error:", err);
        const msg =
          err instanceof Error ? err.message : "Generation stream encountered an error.";
        setQaTurns((prev) =>
          prev.map((t) => {
            if (t.turnId !== turnId) return t;
            return {
              ...t,
              error: msg,
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
    },
    [mode]
  );

  // Submit question from user input
  const handleSubmitQuestion = (questionText: string) => {
    if (!sessionId || !documentFullText || isStreaming) return;
    executeQuestion(questionText, sessionId, documentFullText, chunks);
  };

  // Automatically persist session changes to IndexedDB
  useEffect(() => {
    if (sessionId && documentMeta) {
      persistSession();
    }
  }, [sessionId, documentMeta, qaTurns, totalClaimsVerified, totalRetrievalLatencyMs, lastRetrievalLatencyMs, persistSession]);

  const avgRetrievalLatencyMs =
    totalClaimsVerified > 0 ? totalRetrievalLatencyMs / totalClaimsVerified : 0;

  const handleExportAuditReport = useCallback(() => {
    if (!documentMeta || qaTurns.length === 0) return;

    const reportLines: string[] = [];
    reportLines.push(`# TRIPWIRE VERIFICATION AUDIT REPORT`);
    reportLines.push(`Document: ${documentMeta.filename} (${documentMeta.pageCount} pages)`);
    reportLines.push(`Generated: ${new Date().toLocaleString()}`);
    reportLines.push(`Total Verified Claims: ${totalClaimsVerified}`);
    reportLines.push(`Average Moss Retrieval Latency: ${avgRetrievalLatencyMs.toFixed(2)}ms`);
    reportLines.push(`--------------------------------------------------\n`);

    qaTurns.forEach((turn, tIdx) => {
      reportLines.push(`[TURN ${tIdx + 1}] Q: ${turn.questionText}`);
      reportLines.push(`Mode: ${turn.mode.toUpperCase()}`);
      turn.answerSentences.forEach((s) => {
        reportLines.push(`  - [${s.status}] "${s.text}"`);
        if (s.retrievalLatencyMs > 0) {
          reportLines.push(`    Retrieval: ${s.retrievalLatencyMs.toFixed(1)}ms | Verdict Check: ${s.verdictLatencyMs || 0}ms`);
        }
        if (s.explanation) {
          reportLines.push(`    Explanation: ${s.explanation}`);
        }
        if (s.matchedChunkText) {
          reportLines.push(`    Matched Source: "${s.matchedChunkText.slice(0, 150)}..."`);
        }
      });
      reportLines.push('');
    });

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripwire-audit-${documentMeta.filename.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [documentMeta, qaTurns, totalClaimsVerified, avgRetrievalLatencyMs]);

  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-white font-sans selection:bg-white/20 selection:text-white">
      {/* Saved Sessions Sidebar */}
      <ChatHistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        activeConversationId={sessionId}
        onSelectConversation={handleSelectConversation}
        onNewDocument={handleResetDocument}
      />

      {!documentMeta ? (
        <UploadScreen
          onDocumentLoaded={handleDocumentLoaded}
          onBackToLanding={() => router.push("/")}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />
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
            onBackToLanding={() => router.push("/")}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onExportAuditReport={handleExportAuditReport}
          />

          <main className="flex-1 flex flex-col justify-between">
            <QAThread
              qaTurns={qaTurns}
              onSelectSentence={(s) => setSelectedSentence(s)}
              selectedSentenceId={selectedSentence?.sentenceId || null}
              onRetry={handleSubmitQuestion}
              onSelectSampleQuestion={handleSubmitQuestion}
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

export default function AgentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AgentWorkspace />
    </Suspense>
  );
}
