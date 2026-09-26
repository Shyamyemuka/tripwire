"use client";

import React from "react";
import Image from "next/image";
import { QATurn, SentenceVerificationRecord, VerificationStatus } from "@/lib/types";
import {
  User,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  HelpCircle,
  Loader2,
} from "lucide-react";

import { Zap, Sparkles } from "lucide-react";

interface QAThreadProps {
  qaTurns: QATurn[];
  onSelectSentence: (record: SentenceVerificationRecord) => void;
  selectedSentenceId: string | null;
  onRetry?: (questionText: string) => void;
  suggestedTopics?: string[];
  onSelectTopicChip?: (topicText: string) => void;
}

interface SentenceGroup {
  type: "paragraph" | "bullet" | "numbered" | "heading";
  bulletNumber?: string;
  items: Array<{
    sentence: SentenceVerificationRecord;
    index: number;
    status: VerificationStatus;
    cleanedText: string;
  }>;
}

function renderMarkdownInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\*[^*]+?\*|_[^_]+?_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[#F5F7FA]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[#38BDF8] font-mono text-xs border border-white/10"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      parts.push(
        <em key={match.index} className="italic text-[#A8B1BF]">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function groupSentencesIntoBlocks(
  sentences: SentenceVerificationRecord[],
  visibleStatuses: VerificationStatus[]
): SentenceGroup[] {
  const groups: SentenceGroup[] = [];
  let currentGroup: SentenceGroup | null = null;

  sentences.forEach((s, idx) => {
    const rawText = s.text;
    const status = visibleStatuses[idx];

    const bulletMatch = rawText.match(/^\s*([-*•+])\s+([\s\S]*)/);
    const numberMatch = rawText.match(/^\s*(\d+\.)\s+([\s\S]*)/);
    const headingMatch = rawText.match(/^\s*(#{1,3})\s+([\s\S]*)/);

    if (bulletMatch) {
      currentGroup = {
        type: "bullet",
        items: [{ sentence: s, index: idx, status, cleanedText: bulletMatch[2] }],
      };
      groups.push(currentGroup);
    } else if (numberMatch) {
      currentGroup = {
        type: "numbered",
        bulletNumber: numberMatch[1],
        items: [{ sentence: s, index: idx, status, cleanedText: numberMatch[2] }],
      };
      groups.push(currentGroup);
    } else if (headingMatch) {
      currentGroup = {
        type: "heading",
        items: [{ sentence: s, index: idx, status, cleanedText: headingMatch[2] }],
      };
      groups.push(currentGroup);
    } else {
      const prevSentence = idx > 0 ? sentences[idx - 1] : null;
      const prevEndedWithColon = prevSentence && prevSentence.text.trim().endsWith(":");

      if (!currentGroup || currentGroup.type === "heading" || prevEndedWithColon) {
        currentGroup = {
          type: "paragraph",
          items: [{ sentence: s, index: idx, status, cleanedText: rawText.trim() }],
        };
        groups.push(currentGroup);
      } else {
        currentGroup.items.push({ sentence: s, index: idx, status, cleanedText: rawText.trim() });
      }
    }
  });

  return groups;
}

export const QAThread: React.FC<QAThreadProps> = ({
  qaTurns,
  onSelectSentence,
  selectedSentenceId,
  onRetry,
  suggestedTopics = [],
  onSelectTopicChip,
}) => {
  if (qaTurns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#697483] min-h-[420px] max-w-2xl mx-auto w-full">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-white/15 flex items-center justify-center mb-4 p-1.5 shadow-md">
          <Image
            src="/icon.png"
            alt="Tripwire"
            width={44}
            height={44}
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-sm font-medium text-[#F5F7FA]">Document Indexed &amp; Ready for Verification</p>
        <p className="text-xs text-[#A8B1BF] max-w-md mt-1.5 leading-relaxed mb-6">
          Ask any question below. Tripwire extracts sentences on the fly and verifies them against source passages as tokens stream in.
        </p>

        {/* Feature 3: Dynamic Document Topic Chips */}
        {suggestedTopics.length > 0 && (
          <div className="w-full space-y-2.5 animate-blur-fade-up">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-neutral-400">
              <Zap className="w-3 h-3 text-emerald-400 fill-current" />
              <span>Moss Auto-Probed Topic Prompts (Sub-10ms Header Scan)</span>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2">
              {suggestedTopics.slice(0, 3).map((topic, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectTopicChip?.(topic)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 text-xs text-neutral-200 hover:text-white transition-all text-left flex items-center gap-2 max-w-full hover:border-emerald-500/40 group shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">&ldquo;{topic}&rdquo;</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 max-w-4xl mx-auto w-full">
      {qaTurns.map((turn, tIdx) => {
        // Invariant 5: Sentences render in the order they appear, not the order they resolve.
        let canReveal = true;
        const visibleStatuses: VerificationStatus[] = turn.answerSentences.map((s) => {
          if (!canReveal) return "PENDING";
          if (s.status === "PENDING") {
            canReveal = false;
            return "PENDING";
          }
          return s.status;
        });

        const blocks = groupSentencesIntoBlocks(turn.answerSentences, visibleStatuses);

        return (
          <div key={turn.turnId || tIdx} className="space-y-4 animate-blur-fade-up">
            {/* User Question */}
            <div className="flex items-start gap-3 justify-end">
              <div className="glass-card text-white px-4 py-3 rounded-2xl rounded-tr-xs text-sm font-medium max-w-xl shadow-lg border border-white/15 bg-white/[0.08] backdrop-blur-xl">
                {turn.questionText}
              </div>
              <div className="w-7 h-7 rounded-full glass-card border border-white/20 flex items-center justify-center text-neutral-300 shrink-0 mt-0.5 shadow-md">
                <User className="w-4 h-4" />
              </div>
            </div>

            {/* Assistant Streamed & Verified Answer */}
            <div className="flex items-start gap-3 justify-start">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex items-center justify-center shrink-0 mt-0.5 bg-black p-0.5 shadow-md">
                <Image
                  src="/icon.png"
                  alt="Tripwire AI"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 glass-panel p-5 sm:p-6 rounded-2xl rounded-tl-xs border border-white/15 shadow-2xl space-y-4 backdrop-blur-2xl">
                {/* Turn Header Tag */}
                <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pb-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold uppercase ${
                        turn.mode === "moss"
                          ? "bg-white/10 text-white border border-white/20"
                          : "bg-white/[0.05] text-neutral-400 border border-white/10"
                      }`}
                    >
                      {turn.mode === "moss" ? "MOSS (sub-10ms)" : "BASELINE (cosine)"}
                    </span>
                    <span>·</span>
                    <span>{turn.answerSentences.length} sentences</span>
                  </div>

                  {turn.isStreaming && (
                    <div className="flex items-center gap-1.5 text-neutral-300 font-sans">
                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                      <span>Streaming &amp; verifying...</span>
                    </div>
                  )}
                </div>

                {/* Error Banner if generation failed */}
                {turn.error && (
                  <div className="p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{turn.error}</span>
                    </div>
                    {onRetry && !turn.isStreaming && (
                      <button
                        onClick={() => onRetry(turn.questionText)}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-white font-medium text-[11px] transition-colors shrink-0 flex items-center gap-1.5"
                      >
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Streamed Sentences with Precision Underlines */}
                <div className="text-sm leading-relaxed space-y-3 font-normal text-[#F5F7FA]">
                  {blocks.map((block, bIdx) => {
                    const renderSentenceItem = (item: SentenceGroup["items"][0]) => {
                      const { sentence, index, status, cleanedText } = item;
                      const isSelected = selectedSentenceId === sentence.sentenceId;

                      let underlineStyle = "";
                      let title = "";
                      let indicatorIcon = null;

                      switch (status) {
                        case "GREEN":
                          underlineStyle =
                            "border-b-2 border-[#22C55E] hover:bg-[#22C55E]/[0.08] cursor-pointer transition-colors text-[#F5F7FA]";
                          title = `Supported by source (${sentence.retrievalLatencyMs.toFixed(1)}ms retrieval) — Click to view exact source passage`;
                          indicatorIcon = (
                            <span className="inline-flex items-center ml-1 text-[#22C55E] text-[10px]" title="Supported">
                              <Check className="w-3 h-3 inline" />
                            </span>
                          );
                          break;

                        case "RED":
                          underlineStyle =
                            "border-b-2 border-[#EF4444] hover:bg-[#EF4444]/[0.10] cursor-pointer transition-colors font-medium text-[#F5F7FA]";
                          title = "Contradiction detected! Click to view conflicting source evidence";
                          indicatorIcon = (
                            <span className="inline-flex items-center ml-1 text-[#EF4444] text-[10px] font-bold" title="Contradicted">
                              <X className="w-3 h-3 inline" />
                            </span>
                          );
                          break;

                        case "AMBER":
                          underlineStyle =
                            "border-b-2 border-[#F59E0B] hover:bg-[#F59E0B]/[0.08] cursor-pointer transition-colors text-[#F5F7FA]";
                          title = "Unverifiable claim / No matching passage — Click to inspect";
                          indicatorIcon = (
                            <span className="inline-flex items-center ml-1 text-[#F59E0B] text-[10px]" title="Unverifiable">
                              <HelpCircle className="w-3 h-3 inline" />
                            </span>
                          );
                          break;

                        case "GREY":
                          underlineStyle = "text-[#A8B1BF]";
                          title = "Filtered / Non-factual claim (opinion or transition)";
                          break;

                        case "PENDING":
                        default:
                          underlineStyle = "text-neutral-400";
                          title = "Verifying claim...";
                          indicatorIcon = (
                            <span className="inline-flex items-center ml-1.5 text-neutral-400 text-[10px] font-mono animate-pulse">
                              ⋯ verifying
                            </span>
                          );
                          break;
                      }

                      return (
                        <span
                          key={sentence.sentenceId || index}
                          onClick={() => {
                            if (status !== "PENDING" && status !== "GREY") {
                              onSelectSentence(sentence);
                            }
                          }}
                          title={title}
                          className={`inline pb-0.5 rounded-sm transition-all ${underlineStyle} ${
                            isSelected
                              ? "bg-white/[0.08] outline-hidden ring-1 ring-white/50 px-1"
                              : ""
                          }`}
                        >
                          {renderMarkdownInline(cleanedText)}
                          {indicatorIcon}
                          {" "}
                        </span>
                      );
                    };

                    if (block.type === "bullet") {
                      return (
                        <div key={bIdx} className="flex items-start gap-2.5 my-1.5 pl-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-2 shrink-0 select-none" />
                          <div className="flex-1 leading-relaxed space-x-1.5">
                            {block.items.map(renderSentenceItem)}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === "numbered") {
                      return (
                        <div key={bIdx} className="flex items-start gap-2.5 my-1.5 pl-2">
                          <span className="text-xs font-mono font-semibold text-[#697483] mt-0.5 shrink-0 select-none">
                            {block.bulletNumber}
                          </span>
                          <div className="flex-1 leading-relaxed space-x-1.5">
                            {block.items.map(renderSentenceItem)}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === "heading") {
                      return (
                        <div key={bIdx} className="font-medium text-base text-[#F5F7FA] mt-3 mb-1">
                          {block.items.map(renderSentenceItem)}
                        </div>
                      );
                    }

                    return (
                      <div key={bIdx} className="leading-relaxed space-x-1.5">
                        {block.items.map(renderSentenceItem)}
                      </div>
                    );
                  })}
                </div>

                {/* Compact Flagged Claims Summary */}
                {(() => {
                  const flaggedCount = turn.answerSentences.filter(
                    (s) => s.status === "RED" || s.status === "AMBER"
                  ).length;

                  if (flaggedCount === 0) return null;

                  const hasRed = turn.answerSentences.some((s) => s.status === "RED");

                  return (
                    <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        {hasRed ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className={hasRed ? "text-rose-400 font-semibold" : "text-amber-400 font-semibold"}>
                          {flaggedCount} {flaggedCount === 1 ? "claim" : "claims"} flagged
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        Click any underlined claim to view source evidence
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};