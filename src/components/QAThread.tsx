"use client";

import React from 'react';
import { QATurn, SentenceVerificationRecord, VerificationStatus } from '@/lib/types';
import { Bot, User, AlertCircle, AlertTriangle, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';

interface QAThreadProps {
  qaTurns: QATurn[];
  onSelectSentence: (record: SentenceVerificationRecord) => void;
  selectedSentenceId: string | null;
}

interface SentenceGroup {
  type: 'paragraph' | 'bullet' | 'numbered' | 'heading';
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
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      parts.push(
        <strong key={match.index} className="font-semibold text-zinc-950 dark:text-zinc-50">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-mono text-xs border border-zinc-200 dark:border-zinc-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      parts.push(
        <em key={match.index} className="italic text-zinc-800 dark:text-zinc-200">
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
        type: 'bullet',
        items: [{ sentence: s, index: idx, status, cleanedText: bulletMatch[2] }]
      };
      groups.push(currentGroup);
    } else if (numberMatch) {
      currentGroup = {
        type: 'numbered',
        bulletNumber: numberMatch[1],
        items: [{ sentence: s, index: idx, status, cleanedText: numberMatch[2] }]
      };
      groups.push(currentGroup);
    } else if (headingMatch) {
      currentGroup = {
        type: 'heading',
        items: [{ sentence: s, index: idx, status, cleanedText: headingMatch[2] }]
      };
      groups.push(currentGroup);
    } else {
      const prevSentence = idx > 0 ? sentences[idx - 1] : null;
      const prevEndedWithColon = prevSentence && prevSentence.text.trim().endsWith(':');

      if (!currentGroup || currentGroup.type === 'heading' || prevEndedWithColon) {
        currentGroup = {
          type: 'paragraph',
          items: [{ sentence: s, index: idx, status, cleanedText: rawText.trim() }]
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

        const blocks = groupSentencesIntoBlocks(turn.answerSentences, visibleStatuses);

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

                {/* Streamed Sentences with Markdown & Inline Underlines */}
                <div className="text-sm leading-relaxed space-y-2 font-normal text-zinc-800 dark:text-zinc-200">
                  {blocks.map((block, bIdx) => {
                    const renderSentenceItem = (item: SentenceGroup['items'][0]) => {
                      const { sentence, index, status, cleanedText } = item;
                      const isSelected = selectedSentenceId === sentence.sentenceId;

                      let highlightStyle = '';
                      let title = '';

                      switch (status) {
                        case 'GREEN':
                          // Authentic PDF-style fluorescent green highlighter
                          highlightStyle = 'bg-emerald-400/25 dark:bg-emerald-500/25 text-zinc-900 dark:text-zinc-100 rounded px-1 py-0.5 box-decoration-clone cursor-pointer hover:bg-emerald-400/40 dark:hover:bg-emerald-500/40 transition-colors';
                          title = `Supported by source (${sentence.retrievalLatencyMs.toFixed(1)}ms retrieval) — Click to inspect in side panel`;
                          break;
                        case 'RED':
                          // Authentic PDF-style fluorescent rose/red highlighter
                          highlightStyle = 'bg-rose-500/25 dark:bg-rose-500/30 text-rose-950 dark:text-rose-100 font-medium rounded px-1 py-0.5 box-decoration-clone cursor-pointer hover:bg-rose-500/40 dark:hover:bg-rose-500/45 transition-colors';
                          title = 'Contradiction detected! Click to inspect in side panel';
                          break;
                        case 'AMBER':
                          // Authentic PDF-style fluorescent amber/yellow highlighter
                          highlightStyle = 'bg-amber-400/30 dark:bg-amber-400/25 text-amber-950 dark:text-amber-100 rounded px-1 py-0.5 box-decoration-clone cursor-pointer hover:bg-amber-400/45 dark:hover:bg-amber-400/35 transition-colors';
                          title = 'Unverifiable / No direct match — Click to inspect in side panel';
                          break;
                        case 'GREY':
                          highlightStyle = 'text-zinc-500 dark:text-zinc-400';
                          title = 'Not a factual claim (opinion / transition)';
                          break;
                        case 'PENDING':
                        default:
                          highlightStyle = 'text-zinc-700 dark:text-zinc-300 opacity-80 animate-pulse';
                          title = 'Verifying sentence...';
                          break;
                      }

                      return (
                        <span
                          key={sentence.sentenceId || index}
                          onClick={() => {
                            if (status !== 'PENDING' && status !== 'GREY') {
                              onSelectSentence(sentence);
                            }
                          }}
                          title={title}
                          className={`inline transition-all ${highlightStyle} ${
                            isSelected ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-1 dark:ring-offset-zinc-900' : ''
                          }`}
                        >
                          {renderMarkdownInline(cleanedText)}{' '}
                        </span>
                      );
                    };

                    if (block.type === 'bullet') {
                      return (
                        <div key={bIdx} className="flex items-start gap-2.5 my-1.5 pl-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0 select-none" />
                          <div className="flex-1 leading-relaxed space-x-1.5">
                            {block.items.map(renderSentenceItem)}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'numbered') {
                      return (
                        <div key={bIdx} className="flex items-start gap-2.5 my-1.5 pl-2">
                          <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0 select-none">
                            {block.bulletNumber}
                          </span>
                          <div className="flex-1 leading-relaxed space-x-1.5">
                            {block.items.map(renderSentenceItem)}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'heading') {
                      return (
                        <div key={bIdx} className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mt-3 mb-1">
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

                {/* FR-10: Single Consolidated Audit Card for Flagged Claims */}
                {(() => {
                  const flaggedItems = turn.answerSentences.filter(
                    (s) => (s.status === 'RED' || s.status === 'AMBER') && s.explanation
                  );

                  if (flaggedItems.length === 0) return null;

                  const hasRed = flaggedItems.some((s) => s.status === 'RED');

                  return (
                    <div
                      className={`mt-4 p-4 rounded-xl text-xs border transition-all ${
                        hasRed
                          ? 'bg-rose-500/5 border-rose-500/25 text-rose-950 dark:text-rose-200'
                          : 'bg-amber-500/5 border-amber-500/25 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-700/50">
                        <div className="flex items-center gap-2">
                          {hasRed ? (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                            {hasRed ? 'Fact Contradictions & Unverified Claims' : 'Unverified Claim Notice'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                            hasRed
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {flaggedItems.length} {flaggedItems.length === 1 ? 'claim' : 'claims'} flagged
                        </span>
                      </div>

                      {/* Bulleted Points of Issues */}
                      <div className="pt-2.5 space-y-2">
                        {flaggedItems.map((sentence) => {
                          const isRed = sentence.status === 'RED';
                          const cleanSnippet = sentence.text
                            .replace(/^[*•#-]\s*/, '')
                            .replace(/\*\*/g, '')
                            .slice(0, 65);

                          return (
                            <div
                              key={`expl-${sentence.sentenceId}`}
                              onClick={() => onSelectSentence(sentence)}
                              className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                  isRed ? 'bg-rose-500' : 'bg-amber-500'
                                }`}
                              />
                              <div className="flex-1 leading-relaxed">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 mr-1.5">
                                  &ldquo;{cleanSnippet}{sentence.text.length > 65 ? '...' : ''}&rdquo;
                                </span>
                                <span className="text-zinc-600 dark:text-zinc-300">
                                  — {sentence.explanation}
                                </span>
                              </div>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shrink-0 flex items-center gap-1 font-medium mt-0.5">
                                Audit in side panel
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer Hint */}
                      <div className="mt-2 pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span>Click any claim above to inspect matched source passages in the side panel.</span>
                      </div>
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