"use client";

import React from 'react';
import { QATurn, SentenceVerificationRecord, VerificationStatus } from '@/lib/types';
import { Bot, User, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

interface QAThreadProps {
  qaTurns: QATurn[];
  onSelectSentence: (record: SentenceVerificationRecord) => void;
  selectedSentenceId: string | null;
}

export const QAThread: React.FC<QAThreadProps> = ({
  qaTurns,
  onSelectSentence,
  selectedSentenceId
}) => {
  if (qaTurns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
        <Sparkles className="w-8 h-8 mb-3 text-zinc-300 dark:text-zinc-600 animate-pulse" />
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Document Indexed &amp; Ready</p>
        <p className="text-xs text-zinc-400 max-w-sm mt-1">
          Ask a question below. Sentences will be verified inline against the document as tokens stream in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 max-w-4xl mx-auto w-full">
      {qaTurns.map((turn, tIdx) => {
        // Invariant 5: Sentences render in the order they appear, not the order they resolve.
        // Compute which sentences can be visually revealed in strict order:
        let canReveal = true;
        const visibleStatuses: VerificationStatus[] = turn.answerSentences.map((s) => {
          if (!canReveal) return 'PENDING';
          if (s.status === 'PENDING') {
            canReveal = false;
            return 'PENDING';
          }
          return s.status;
        });

        return (
          <div key={turn.turnId || tIdx} className="space-y-4">
            {/* User Question */}
            <div className="flex items-start gap-3 justify-end">
              <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-medium max-w-xl shadow-xs border border-zinc-200/50 dark:border-zinc-700/50">
                {turn.questionText}
              </div>
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            </div>

            {/* Assistant Streamed & Verified Answer */}
            <div className="flex items-start gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>

              <div className="flex-1 bg-white dark:bg-zinc-900/80 p-5 rounded-2xl rounded-tl-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
                {/* Mode Tag */}
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className={`px-1.5 py-0.5 rounded font-semibold uppercase ${
                    turn.mode === 'moss' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {turn.mode} mode
                  </span>
                  <span>·</span>
                  <span>{turn.answerSentences.length} sentences</span>
                  {turn.isStreaming && (
                    <span className="text-emerald-500 animate-pulse font-sans">● Streaming...</span>
                  )}
                </div>

                {/* Error Banner if generation failed */}
                {turn.error && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{turn.error}</span>
                  </div>
                )}

                {/* Streamed Sentences with Inline Underlines */}
                <div className="text-sm leading-relaxed space-x-1.5 font-normal">
                  {turn.answerSentences.map((sentence, sIdx) => {
                    const status = visibleStatuses[sIdx];
                    const isSelected = selectedSentenceId === sentence.sentenceId;

                    let underlineStyle = '';
                    let title = '';

                    switch (status) {
                      case 'GREEN':
                        underlineStyle = 'underline decoration-emerald-500 decoration-2 underline-offset-4 bg-emerald-500/10 rounded-sm px-1 py-0.5 cursor-pointer hover:bg-emerald-500/20 transition-colors';
                        title = `Supported by source (${sentence.retrievalLatencyMs.toFixed(1)}ms retrieval) — Click to view source`;
                        break;
                      case 'RED':
                        underlineStyle = 'underline decoration-rose-500 decoration-2 underline-offset-4 bg-rose-500/10 text-rose-900 dark:text-rose-200 rounded-sm px-1 py-0.5 cursor-pointer hover:bg-rose-500/20 transition-colors font-medium';
                        title = 'Contradiction detected! Click to audit source passage';
                        break;
                      case 'AMBER':
                        underlineStyle = 'underline decoration-amber-500 decoration-2 underline-offset-4 bg-amber-500/10 rounded-sm px-1 py-0.5 cursor-pointer hover:bg-amber-500/20 transition-colors';
                        title = 'Unverifiable / No direct match — Click to audit';
                        break;
                      case 'GREY':
                        underlineStyle = 'text-zinc-500 dark:text-zinc-400 no-underline';
                        title = 'Not a factual claim (opinion / transition)';
                        break;
                      case 'PENDING':
                      default:
                        underlineStyle = 'text-zinc-800 dark:text-zinc-200';
                        title = 'Verifying...';
                        break;
                    }

                    return (
                      <span
                        key={sentence.sentenceId || sIdx}
                        onClick={() => {
                          if (status !== 'PENDING' && status !== 'GREY') {
                            onSelectSentence(sentence);
                          }
                        }}
                        title={title}
                        className={`inline transition-all ${underlineStyle} ${
                          isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : ''
                        }`}
                      >
                        {sentence.text}{' '}
                      </span>
                    );
                  })}
                </div>

                {/* FR-10: Async Non-Blocking Explanation Blocks for Flagged Sentences */}
                <div className="space-y-2 pt-2">
                  {turn.answerSentences.map((sentence) => {
                    if (!sentence.explanation) return null;

                    const isRed = sentence.status === 'RED';
                    return (
                      <div
                        key={`expl-${sentence.sentenceId}`}
                        onClick={() => onSelectSentence(sentence)}
                        className={`p-3 rounded-xl text-xs flex items-start gap-2.5 cursor-pointer transition-all border ${
                          isRed
                            ? 'bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-300 hover:bg-rose-500/10'
                            : 'bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10'
                        }`}
                      >
                        {isRed ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <span className="font-semibold block text-[11px]">
                            {isRed ? 'Fact Contradiction Detected:' : 'Unverified Claim Notice:'}
                          </span>
                          <p className="leading-snug">{sentence.explanation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};