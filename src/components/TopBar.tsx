"use client";

import React from "react";
import { DocumentMeta, RetrievalMode } from "@/lib/types";
import {
  FileText,
  AlertTriangle,
  Zap,
  Database,
  RotateCcw,
  ArrowLeft,
  Clock,
  Download,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TopBarProps {
  documentMeta: DocumentMeta;
  mode: RetrievalMode;
  onToggleMode: (newMode: RetrievalMode) => void;
  lastRetrievalLatencyMs: number | null;
  totalClaimsVerified: number;
  avgRetrievalLatencyMs: number;
  onResetDocument: () => void;
  onBackToLanding?: () => void;
  onOpenHistory?: () => void;
  onExportAuditReport?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  documentMeta,
  mode,
  onToggleMode,
  lastRetrievalLatencyMs,
  totalClaimsVerified,
  avgRetrievalLatencyMs,
  onResetDocument,
  onBackToLanding,
  onOpenHistory,
  onExportAuditReport,
}) => {
  return (
    <header className="border-b border-white/10 bg-black/90 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Side: Brand, Back, and Document Metadata */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            {onBackToLanding ? (
              <button
                onClick={onBackToLanding}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Return to landing page"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href="/"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Return to landing page"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}

            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-md overflow-hidden border border-white/20 bg-black flex items-center justify-center p-0.5 group-hover:border-white/40 transition-colors shrink-0">
                <Image
                  src="/icon.png"
                  alt="Tripwire Logo"
                  width={24}
                  height={24}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <span className="font-medium text-sm sm:text-base tracking-[0.1em] text-white">
                TRIPWIRE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            </Link>

            <span className="text-white/20 mx-0.5">|</span>

            {/* Document badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-xs text-neutral-300 max-w-[200px] sm:max-w-[320px]">
              <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate font-mono text-[11px] text-white">
                {documentMeta.filename}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[10px] text-neutral-400 shrink-0">
                {documentMeta.pageCount} {documentMeta.pageCount === 1 ? "page" : "pages"}
              </span>
            </div>
          </div>

          {/* Reset document control */}
          <button
            onClick={onResetDocument}
            title="Upload a different document"
            className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline text-[11px] text-neutral-400">Change</span>
          </button>

          {/* History drawer trigger */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              title="Open saved sessions"
              className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 text-xs ml-1"
            >
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline text-[11px] text-neutral-400">History</span>
            </button>
          )}

          {/* Export Audit Report Button for Hackathon Judges */}
          {onExportAuditReport && (
            <button
              onClick={onExportAuditReport}
              title="Export Verification Audit Report"
              className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 text-xs ml-1"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline text-[11px] text-neutral-400">Export Report</span>
            </button>
          )}
        </div>

        {/* Center / Right Side: MOSS / BASELINE segmented pill toggle & Measured Latencies */}
        <div className="flex items-center gap-4 text-xs w-full md:w-auto justify-between md:justify-end">
          {/* MOSS / BASELINE Segmented Pill Toggle */}
          <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => onToggleMode("moss")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mode === "moss"
                  ? "bg-white text-black shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 fill-current" />
              <span>MOSS</span>
            </button>
            <button
              onClick={() => onToggleMode("baseline")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mode === "baseline"
                  ? "bg-white/20 text-white border border-white/20 shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Database className="w-3 h-3" />
              <span>BASELINE</span>
            </button>
          </div>

          {/* Real-time Measured Latency Readout */}
          <div className="flex items-center gap-3 border-l border-white/10 pl-3">
            <div className="text-right">
              <div className="text-[11px] font-mono font-medium text-white flex items-center justify-end gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${mode === 'moss' ? 'bg-white' : 'bg-neutral-400'}`} />
                {lastRetrievalLatencyMs !== null
                  ? `${mode === "moss" ? "Moss" : "Baseline"} retrieval: ${lastRetrievalLatencyMs.toFixed(1)}ms`
                  : `${mode === "moss" ? "Moss" : "Baseline"} ready`}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                verified {totalClaimsVerified} claims · avg {avgRetrievalLatencyMs.toFixed(1)}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FR-2 Persistent Truncation Warning */}
      {documentMeta.truncated && (
        <div className="mt-2 py-1.5 px-3 rounded-lg bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              <strong>Document truncated:</strong> {documentMeta.truncatedPageRange || "Only pages 1–20 / 8,000 words indexed."}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono opacity-80">
            Session Warning
          </span>
        </div>
      )}
    </header>
  );
};