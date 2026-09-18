"use client";

import React from 'react';
import { QATurn, SentenceVerificationRecord, VerificationStatus } from '@/lib/types';
import { Bot, User, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

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
                          key={sentence.sentenceId || index}
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