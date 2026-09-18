"use client";

import React from 'react';
import { SentenceVerificationRecord } from '@/lib/types';
import { X, CheckCircle2, AlertTriangle, HelpCircle, FileText } from 'lucide-react';

interface SourcePanelProps {
  sentenceRecord: SentenceVerificationRecord | null;
  onClose: () => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ sentenceRecord, onClose }) => {
  if (!sentenceRecord) return null;

  const getStatusBadge = () => {
    switch (sentenceRecord.status) {
      case 'GREEN':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SUPPORTED
          </div>
        );
      case 'RED':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            CONTRADICTED
          </div>
        );
      case 'AMBER':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            UNVERIFIABLE
          </div>
        );
      case 'GREY':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-500/10 text-zinc-500 text-xs font-semibold border border-zinc-500/20">
            NOT FACTUAL (OPINION/FILLER)
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-semibold">
            PENDING
          </div>
        );
    }
  };

  const candidates = sentenceRecord.topCandidates || [];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col transition-all">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Source Grounding Audit
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status and Latency summary */}
        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
          <div>{getStatusBadge()}</div>
          <div className="text-right text-[11px] font-mono text-zinc-500 space-y-0.5">
            <div>Retrieval: {sentenceRecord.retrievalLatencyMs.toFixed(1)}ms</div>
            {sentenceRecord.verdictLatencyMs !== null && (
              <div>Verdict: {sentenceRecord.verdictLatencyMs.toFixed(1)}ms</div>
            )}
          </div>
        </div>

        {/* The Claim */}
        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
            Generated Sentence
          </label>
          <div className="p-3.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/80 text-sm font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700/60">
            &quot;{sentenceRecord.text}&quot;
          </div>
        </div>

        {/* Explanation if Contradicted or Amber */}
        {sentenceRecord.explanation && (
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              sentenceRecord.status === 'RED'
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
            }`}
          >
            <span className="font-semibold block mb-1">
              {sentenceRecord.status === 'RED' ? 'Contradiction Analysis:' : 'Unverified Claim Grounding Issue:'}
            </span>
            {sentenceRecord.explanation}
          </div>
        )}

        {/* Matched Source Passages */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {candidates.length > 1 ? `Top ${candidates.length} Candidate Passages` : 'Matched Source Passage'}
            </label>
            {sentenceRecord.similarityScore !== null && (
              <span className="text-xs font-mono text-zinc-500">
                Similarity: {(sentenceRecord.similarityScore * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {candidates.length > 0 ? (
            <div className="space-y-3">
              {candidates.map((cand, idx) => (
                <div
                  key={cand.chunkId || idx}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700/70 bg-white dark:bg-zinc-800/40 text-xs text-zinc-800 dark:text-zinc-200 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono border-b border-zinc-100 dark:border-zinc-700/50 pb-1.5">
                    <span>Page {cand.pageNumber} · Offset {cand.charOffsetStart}-{cand.charOffsetEnd}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Score: {(cand.similarityScore * 100).toFixed(1)}%</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{cand.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
              No matching source passages met the similarity floor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};