"use client";

import React from 'react';
import { DocumentMeta, RetrievalMode } from '@/lib/types';
import { FileText, AlertTriangle, Zap, Database, RotateCcw } from 'lucide-react';

interface TopBarProps {
  documentMeta: DocumentMeta;
  mode: RetrievalMode;
  onToggleMode: (newMode: RetrievalMode) => void;
  lastRetrievalLatencyMs: number | null;
  totalClaimsVerified: number;
  avgRetrievalLatencyMs: number;
  onResetDocument: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  documentMeta,
  mode,
  onToggleMode,
  lastRetrievalLatencyMs,
  totalClaimsVerified,
  avgRetrievalLatencyMs,
  onResetDocument,
}) => {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Document details and truncation warning */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Tripwire
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div className="flex items-center gap-1.5 font-medium truncate max-w-[180px] sm:max-w-[280px]">
              <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{documentMeta.filename}</span>
            </div>
            <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500">
              {documentMeta.pageCount} {documentMeta.pageCount === 1 ? 'page' : 'pages'} · {documentMeta.wordCount} words
            </span>
          </div>

          <button
            onClick={onResetDocument}
            title="Upload a different document"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center/Right: A/B Toggle & Measured Latency Counters */}
        <div className="flex items-center gap-3 text-xs w-full md:w-auto justify-between md:justify-end">
          {/* FR-12: A/B Latency Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => onToggleMode('moss')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                mode === 'moss'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              Moss (&lt;30ms)
            </button>
            <button
              onClick={() => onToggleMode('baseline')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                mode === 'baseline'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Database className="w-3 h-3" />
              Baseline (Cosine)
            </button>
          </div>

          {/* Real-time Measured Latency Readout & Speedup Advantage */}
          <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-3">
            <div className="text-right">
              <div className="text-[11px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-end gap-1.5">
                {lastRetrievalLatencyMs !== null ? (
                  <>
                    <span>{mode === 'moss' ? 'Moss' : 'Baseline'}: {lastRetrievalLatencyMs.toFixed(1)}ms</span>
                    {mode === 'moss' && lastRetrievalLatencyMs < 30 && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Sub-30ms
                      </span>
                    )}
                  </>
                ) : (
                  'Ready'
                )}
              </div>
              <div className="text-[10px] text-zinc-500">
                verified {totalClaimsVerified} claims · avg {avgRetrievalLatencyMs.toFixed(1)}ms
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FR-2 Truncation Banner */}
      {documentMeta.truncated && (
        <div className="mt-2 py-1 px-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Document truncated:</strong> {documentMeta.truncatedPageRange || 'Only first 20 pages / 8,000 words indexed.'}
          </span>
        </div>
      )}
    </header>
  );
};