"use client";

import React from "react";
import { DocumentMeta, RetrievalMode } from "@/lib/types";
import {
  FileText,
  AlertTriangle,
  Zap,
  Database,
  RotateCcw,
  Clock,
  Download,
  BarChart3,
  Home,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { MagnificationDock, DockItemData } from "@/components/ui/magnification-dock";

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
  isStressTestMode?: boolean;
  onToggleStressTestMode?: () => void;
  onOpenAnalytics?: () => void;
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
  isStressTestMode,
  onToggleStressTestMode,
  onOpenAnalytics,
}) => {
  const dockItems: DockItemData[] = [
    {
      icon: <Home className="w-4.5 h-4.5" />,
      label: "Landing Page",
      onClick: () => {
        if (onBackToLanding) onBackToLanding();
        else window.location.href = "/";
      },
    },
    {
      icon: <RotateCcw className="w-4.5 h-4.5" />,
      label: "Change Document",
      onClick: onResetDocument,
    },
    ...(onOpenHistory
      ? [
          {
            icon: <Clock className="w-4.5 h-4.5" />,
            label: "History & Sessions",
            onClick: onOpenHistory,
          },
        ]
      : []),
    ...(onOpenAnalytics
      ? [
          {
            icon: <BarChart3 className="w-4.5 h-4.5" />,
            label: "Trust Scorecard",
            onClick: onOpenAnalytics,
          },
        ]
      : []),
    {
      icon:
        mode === "moss" ? (
          <Zap className="w-4.5 h-4.5 text-emerald-400 fill-current" />
        ) : (
          <Database className="w-4.5 h-4.5 text-amber-400" />
        ),
      label: `Mode: ${mode.toUpperCase()} (Toggle)`,
      onClick: () => onToggleMode(mode === "moss" ? "baseline" : "moss"),
      active: mode === "moss",
    },
    ...(onToggleStressTestMode
      ? [
          {
            icon: (
              <AlertTriangle
                className={`w-4.5 h-4.5 ${isStressTestMode ? "text-rose-400" : ""}`}
              />
            ),
            label: `Stress-Test: ${isStressTestMode ? "ACTIVE" : "OFF"}`,
            onClick: onToggleStressTestMode,
            active: isStressTestMode,
          },
        ]
      : []),
    ...(onExportAuditReport
      ? [
          {
            icon: <Download className="w-4.5 h-4.5" />,
            label: "Export Audit Report",
            onClick: onExportAuditReport,
          },
        ]
      : []),
  ];

  return (
    <header className="glass-nav sticky top-0 z-40 px-4 sm:px-6 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Side: Logo & Document Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-xl overflow-hidden border border-white/20 bg-black flex items-center justify-center p-0.5 group-hover:border-white/40 transition-colors shrink-0 shadow-md">
              <Image
                src="/icon.png"
                alt="Tripwire Logo"
                width={26}
                height={26}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-[0.12em] text-white">
              TRIPWIRE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </Link>

          <span className="text-white/20 mx-0.5 hidden sm:inline">|</span>

          {/* Document badge */}
          <div className="glass-badge flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-neutral-300 max-w-[200px] sm:max-w-[320px]">
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

        {/* Center: Premium MagnificationDock */}
        <div className="flex items-center justify-center my-1 md:my-0">
          <MagnificationDock
            items={dockItems}
            panelHeight={48}
            baseItemSize={36}
            magnification={54}
            distance={140}
          />
        </div>

        {/* Right Side: Speedometer Gauge */}
        <div className="flex items-center gap-3 text-xs w-full md:w-auto justify-end">
          <div className="glass-card flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/15">
            {/* Visual Speedometer Gauge Ring */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={mode === "moss" ? "text-emerald-400" : "text-amber-400"}
                  strokeDasharray={`${
                    lastRetrievalLatencyMs !== null
                      ? Math.min(100, Math.max(10, 100 - (lastRetrievalLatencyMs || 0) * 2))
                      : 0
                  }, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <Zap
                className={`w-3 h-3 absolute ${
                  mode === "moss"
                    ? "text-emerald-400 fill-current animate-pulse"
                    : "text-amber-400"
                }`}
              />
            </div>

            <div className="text-right">
              <div className="text-[11px] font-mono font-bold text-white flex items-center justify-end gap-1">
                <span className={mode === "moss" ? "text-emerald-400" : "text-amber-400"}>
                  {lastRetrievalLatencyMs !== null
                    ? `${lastRetrievalLatencyMs < 1 ? "<1.0" : lastRetrievalLatencyMs.toFixed(1)}ms`
                    : "—"}
                </span>
                <span className="text-[9px] text-neutral-400 font-sans uppercase">
                  {mode === "moss" ? "Moss" : "Baseline"}
                </span>
              </div>
              <div className="text-[9.5px] text-neutral-400 font-mono">
                {totalClaimsVerified} claims · avg {avgRetrievalLatencyMs.toFixed(1)}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FR-2 Persistent Truncation Warning */}
      {documentMeta.truncated && (
        <div className="mt-2 py-1.5 px-3 rounded-xl bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between max-w-7xl mx-auto backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              <strong>Document truncated:</strong>{" "}
              {documentMeta.truncatedPageRange || "Only pages 1–20 / 8,000 words indexed."}
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
