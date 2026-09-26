"use client";

import React, { useEffect, useState, useRef } from "react";
import { SentenceVerificationRecord } from "@/lib/types";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Clock,
  Copy,
  Check,
  Zap,
  Search,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { CandidatePassage, ChunkRecord } from "@/lib/types";

interface SourcePanelProps {
  sentenceRecord: SentenceVerificationRecord | null;
  sessionId?: string | null;
  chunks?: ChunkRecord[];
  onClose: () => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sentenceRecord,
  sessionId,
  chunks,
  onClose,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [counterCandidates, setCounterCandidates] = useState<CandidatePassage[]>([]);
  const [counterLatencyMs, setCounterLatencyMs] = useState<number | null>(null);
  const [isScanningCounter, setIsScanningCounter] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const counterAbortRef = useRef<AbortController | null>(null);
  const sentenceRecordRef = useRef<SentenceVerificationRecord | null>(sentenceRecord);

  // Cleanup in-flight scan on unmount
  useEffect(() => {
    return () => {
      if (counterAbortRef.current) {
        counterAbortRef.current.abort();
        counterAbortRef.current = null;
      }
    };
  }, []);

  const handleScanCounterEvidence = async () => {
    if (!sentenceRecord || !sessionId || isScanningCounter) return;

    if (counterAbortRef.current) {
      counterAbortRef.current.abort();
    }
    const controller = new AbortController();
    counterAbortRef.current = controller;
    const targetSentenceId = sentenceRecord.sentenceId;

    setIsScanningCounter(true);
    setScanError(null);

    try {
      const res = await fetch("/api/counter-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          sentenceText: sentenceRecord.text,
          chunks,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Counter-evidence scan failed");
      }

      const data = await res.json();
      // Ignore response if the user has switched sentences or aborted
      if (
        counterAbortRef.current !== controller ||
        sentenceRecordRef.current?.sentenceId !== targetSentenceId
      ) {
        return;
      }

      if (data.counterCandidates) {
        setCounterCandidates(data.counterCandidates);
        setCounterLatencyMs(data.timeTakenInMs);
        setHasScanned(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Normal cancellation, do not report error
      }
      if (
        counterAbortRef.current !== controller ||
        sentenceRecordRef.current?.sentenceId !== targetSentenceId
      ) {
        return;
      }
      console.warn("Counter evidence scan error:", err);
      setScanError(err instanceof Error ? err.message : "Counter-evidence scan failed.");
    } finally {
      if (
        counterAbortRef.current === controller &&
        sentenceRecordRef.current?.sentenceId === targetSentenceId
      ) {
        setIsScanningCounter(false);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!sentenceRecord) return null;

  const handleCopySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }).catch((err) => {
      console.warn("Clipboard copy failed:", err);
    });
  };

  const getVerdictBadge = () => {
    switch (sentenceRecord.status) {
      case "GREEN":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>SUPPORTED</span>
          </div>
        );
      case "RED":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>CONTRADICTED</span>
          </div>
        );
      case "AMBER":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>UNVERIFIABLE</span>
          </div>
        );
      case "GREY":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] text-neutral-400 text-xs font-semibold border border-white/10">
            <span>FILTERED / NON-FACTUAL</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold">
            <span>VERIFYING</span>
          </div>
        );
    }
  };

  const candidates = sentenceRecord.topCandidates || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Subtle Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Drawer Surface */}
      <div className="relative z-10 w-full sm:max-w-[440px] md:max-w-[480px] h-full glass-panel border-l border-white/15 shadow-2xl flex flex-col transition-all duration-300 animate-blur-fade-up backdrop-blur-2xl bg-black/75">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/15 flex items-center justify-between bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              SOURCE SPOTLIGHT
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close source panel"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Status & Latency Card */}
          <div className="flex items-center justify-between glass-card p-3.5 rounded-2xl border border-white/15">
            <div>{getVerdictBadge()}</div>
            <div className="text-right text-[11px] font-mono text-neutral-400 space-y-0.5">
              <div className="flex items-center gap-1.5 justify-end text-neutral-300">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>Retrieval: {sentenceRecord.retrievalLatencyMs.toFixed(1)}ms</span>
              </div>
              {sentenceRecord.verdictLatencyMs !== null && (
                <div>Verdict check: {sentenceRecord.verdictLatencyMs.toFixed(1)}ms</div>
              )}
            </div>
          </div>

          {/* Generated Claim */}
          <div>
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
              Generated Claim
            </label>
            <div className="p-3.5 rounded-2xl glass-card text-xs sm:text-sm font-medium text-white border border-white/15 leading-relaxed bg-black/50">
              &ldquo;{sentenceRecord.text}&rdquo;
            </div>
          </div>

          {/* Explanation if flagged (RED or AMBER) */}
          {sentenceRecord.explanation && (
            <div>
              <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                Verification Analysis
              </label>
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  sentenceRecord.status === "RED"
                    ? "bg-rose-950/20 border-rose-500/30 text-white"
                    : "bg-amber-950/20 border-amber-500/30 text-white"
                }`}
              >
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  {sentenceRecord.status === "RED" ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400">Contradiction Discrepancy:</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-400">Unverifiable Grounding Note:</span>
                    </>
                  )}
                </div>
                <p className="text-neutral-300 leading-relaxed">{sentenceRecord.explanation}</p>
              </div>
            </div>
          )}

          {/* Matched Source Passages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-emerald-400 fill-current" />
                {candidates.length > 1
                  ? `Top ${candidates.length} Spotlighted Source Passages`
                  : "Spotlighted Source Passage"}
              </label>
              {sentenceRecord.similarityScore !== null && (
                <span className="text-[10px] font-mono text-neutral-400">
                  Similarity: {(sentenceRecord.similarityScore * 100).toFixed(1)}%
                </span>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="space-y-3">
                {candidates.map((cand, idx) => (
                  <div
                    key={cand.chunkId || idx}
                    className={`p-4 rounded-xl border transition-all ${
                      idx === 0
                        ? "border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.08)] text-white"
                        : "border-white/10 bg-black text-white hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono border-b border-white/[0.08] pb-2 mb-2.5">
                      <span className="text-neutral-300 truncate mr-2">
                        {cand.documentName ? `${cand.documentName} · ` : ""}Page {cand.pageNumber} · Offset {cand.charOffsetStart}–{cand.charOffsetEnd}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-medium">
                          {(cand.similarityScore * 100).toFixed(1)}%
                        </span>
                        <button
                          onClick={() => handleCopySnippet(cand.text, cand.chunkId || `${idx}`)}
                          className="p-1 hover:text-white text-neutral-400 rounded transition-colors"
                          title="Copy snippet text"
                        >
                          {copiedSnippet === (cand.chunkId || `${idx}`) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="leading-relaxed text-neutral-200 whitespace-pre-wrap text-xs sm:text-sm">
                      {cand.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : sentenceRecord.matchedChunkText ? (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10 text-xs text-neutral-200 leading-relaxed">
                {sentenceRecord.matchedChunkText}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-neutral-500">
                No matching source passages met the similarity threshold.
              </div>
            )}
          </div>

          {/* Feature 2: Counter-Evidence & Caveats Scan */}
          {sessionId && (
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Cross-Examine Document
                </label>

                {!hasScanned && !scanError && (
                  <button
                    type="button"
                    onClick={handleScanCounterEvidence}
                    disabled={isScanningCounter}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {isScanningCounter ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Scanning Probes...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-amber-400" />
                        <span>Scan Counter-Evidence &amp; Caveats</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Error State */}
              {scanError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center justify-between gap-2">
                  <span className="truncate">{scanError}</span>
                  <button
                    type="button"
                    onClick={handleScanCounterEvidence}
                    disabled={isScanningCounter}
                    className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-mono text-[10px] shrink-0 transition-colors"
                  >
                    {isScanningCounter ? "Retrying..." : "Retry"}
                  </button>
                </div>
              )}

              {/* Scanned Counter-Evidence Candidates */}
              {hasScanned && !scanError && (
                <div className="space-y-3 animate-blur-fade-up">
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 px-1">
                    <span className="text-amber-300 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-400" />
                      Document Caveats &amp; Contrasting Sections
                    </span>
                    {counterLatencyMs !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        {counterLatencyMs < 1 ? "<1.0" : counterLatencyMs.toFixed(1)}ms Moss
                      </span>
                    )}
                  </div>

                  {counterCandidates.length > 0 ? (
                    <div className="space-y-2.5">
                      {counterCandidates.map((cand, idx) => (
                        <div
                          key={cand.chunkId || idx}
                          className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 text-neutral-200 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 border-b border-white/5 pb-1">
                            <span className="truncate">
                              {cand.documentName ? `${cand.documentName} · ` : ""}Page {cand.pageNumber}
                            </span>
                            <span className="text-amber-400 font-mono">
                              {(cand.similarityScore * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p className="leading-relaxed text-neutral-300 font-mono text-[11px]">
                            {cand.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-white/10 text-center text-xs text-neutral-500 font-mono">
                      No contrasting caveats or policy exceptions detected across document.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notice: Similarity != Truth */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[10px] text-neutral-400 leading-relaxed">
            <strong className="text-neutral-200">Tripwire Verification Invariant:</strong> Candidate passages are retrieved via sub-10ms Moss search. High similarity score indicates relevance; the separate NLI classifier evaluates truthfulness and flags polarity or numeric inversions.
          </div>
        </div>
      </div>
    </div>
  );
};
