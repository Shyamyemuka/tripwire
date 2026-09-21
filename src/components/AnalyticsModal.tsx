"use client";

import React, { useEffect, useState } from "react";
import { QATurn } from "@/lib/types";
import { X, ShieldCheck, Activity, BarChart3, Copy, Check } from "lucide-react";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  qaTurns: QATurn[];
  totalClaimsVerified: number;
  avgRetrievalLatencyMs: number;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  qaTurns,
  totalClaimsVerified,
  avgRetrievalLatencyMs,
}) => {
  const [copiedBadge, setCopiedBadge] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  let greenCount = 0;
  let redCount = 0;
  let amberCount = 0;
  let greyCount = 0;

  qaTurns.forEach((turn) => {
    turn.answerSentences.forEach((s) => {
      if (s.status === "GREEN") greenCount++;
      else if (s.status === "RED") redCount++;
      else if (s.status === "AMBER") amberCount++;
      else if (s.status === "GREY") greyCount++;
    });
  });

  const checkableClaims = greenCount + redCount + amberCount;
  const groundednessIndex = checkableClaims > 0 ? Math.round((greenCount / checkableClaims) * 100) : 0;

  const handleCopyTrustStamp = () => {
    const stampText = [
      `🛡️ TRIPWIRE GROUNDEDNESS AUDIT STAMP`,
      `==================================`,
      `Groundedness Score: ${checkableClaims > 0 ? `${groundednessIndex}%` : "N/A"} (${greenCount}/${checkableClaims} claims supported)`,
      `Supported: ${greenCount} | Contradicted: ${redCount} | Unverifiable: ${amberCount} | Filtered: ${greyCount}`,
      `Average Moss Retrieval Speed: ${avgRetrievalLatencyMs.toFixed(2)}ms`,
      `Total Claims Verified: ${totalClaimsVerified}`,
      `Verified via Tripwire Real-Time Fact-Checking Engine`
    ].join('\n');

    navigator.clipboard.writeText(stampText).then(() => {
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    }).catch((err) => {
      console.warn("Clipboard copy failed:", err);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" />

      {/* Modal Box */}
      <div className="relative z-10 w-full max-w-lg bg-[#0D0B0A] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6 animate-blur-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-white" />
            <span className="text-sm font-semibold uppercase tracking-wider text-white">
              TRUST SCORECARD &amp; ANALYTICS
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scorecard"
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Groundedness Index Gauge */}
        <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/[0.08]">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Groundedness Index
            </div>
            <div className="text-3xl font-bold text-white flex items-baseline gap-2 font-mono">
              <span>{checkableClaims > 0 ? `${groundednessIndex}%` : "—"}</span>
              <span className="text-xs text-emerald-400 font-sans font-medium">
                {checkableClaims === 0
                  ? "No claims verified yet"
                  : groundednessIndex >= 80
                  ? "High Fidelity"
                  : "Flagged Discrepancies"}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Claim Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-[10px] font-mono text-emerald-400 uppercase">Supported</div>
            <div className="text-xl font-bold text-emerald-300 font-mono mt-1">{greenCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <div className="text-[10px] font-mono text-rose-400 uppercase">Contradicted</div>
            <div className="text-xl font-bold text-rose-300 font-mono mt-1">{redCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-[10px] font-mono text-amber-400 uppercase">Unverifiable</div>
            <div className="text-xl font-bold text-amber-300 font-mono mt-1">{amberCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-center">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Filtered / Filler</div>
            <div className="text-xl font-bold text-neutral-300 font-mono mt-1">{greyCount}</div>
          </div>
        </div>

        {/* System Latency & Performance Summary */}
        <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs text-neutral-300">
          <div className="flex justify-between items-center py-1">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-neutral-400" />
              Total Claims Verified
            </span>
            <span className="font-mono font-semibold text-white">{totalClaimsVerified}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-neutral-400">Avg Moss Retrieval Latency</span>
            <span className="font-mono font-semibold text-emerald-400">{avgRetrievalLatencyMs.toFixed(2)}ms</span>
          </div>
        </div>

        {/* Copy Trust Stamp & Close Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyTrustStamp}
            className="flex-1 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            {copiedBadge ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Trust Stamp Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-neutral-300" />
                <span>Copy Trust Stamp</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-all tactile-btn"
          >
            Close Scorecard
          </button>
        </div>
      </div>
    </div>
  );
};
