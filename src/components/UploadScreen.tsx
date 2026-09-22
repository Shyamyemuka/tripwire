"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
} from "lucide-react";
import { SAMPLE_DOCUMENT_TITLE, SAMPLE_DOCUMENT_TEXT } from "@/lib/sample-doc";
import { ChunkRecord, DocumentMeta } from "@/lib/types";

interface UploadScreenProps {
  onDocumentLoaded: (data: {
    sessionId: string;
    documentMeta: DocumentMeta;
    chunks: ChunkRecord[];
    documentFullText: string;
  }) => void;
  onBackToLanding?: () => void;
  onOpenHistory?: () => void;
}

type IndexingStep = "idle" | "reading" | "splitting" | "indexing" | "ready";

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onDocumentLoaded,
  onBackToLanding,
  onOpenHistory,
}) => {
  const [tabMode, setTabMode] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [indexingStep, setIndexingStep] = useState<IndexingStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateStepProgress = async (fn: () => Promise<void>) => {
    setIsLoading(true);
    setIndexingStep("reading");
    const t1 = setTimeout(() => setIndexingStep("splitting"), 350);
    const t2 = setTimeout(() => setIndexingStep("indexing"), 700);

    try {
      await fn();
      setIndexingStep("ready");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setIsLoading(false);
    }
  };

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);

    await simulateStepProgress(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/session", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process document file.");
      }

      onDocumentLoaded(data);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error processing document file.";
      setErrorMessage(msg);
      setIndexingStep("idle");
    });
  };

  const handleProcessPastedText = async (
    text: string,
    title = "pasted-document.txt"
  ) => {
    if (!text.trim()) {
      setErrorMessage("Please paste or provide document text before proceeding.");
      return;
    }

    setErrorMessage(null);

    await simulateStepProgress(async () => {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: title }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process pasted text.");
      }

      onDocumentLoaded(data);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error processing pasted text.";
      setErrorMessage(msg);
      setIndexingStep("idle");
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 md:p-12 bg-transparent text-white selection:bg-white/20 selection:text-white">
      {/* Top Header */}
      <div className="relative z-10 max-w-3xl mx-auto w-full flex items-center justify-between pt-2 pb-6">
        <div className="flex items-center gap-2">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors mr-1"
              title="Return to landing page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-7 h-7 rounded-md overflow-hidden border border-white/20 bg-black flex items-center justify-center p-0.5 shrink-0">
            <Image
              src="/icon.png"
              alt="Tripwire Logo"
              width={28}
              height={28}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <span className="font-medium text-base sm:text-lg tracking-[0.1em] text-white font-sans">
            TRIPWIRE
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
        </div>

        <div className="flex items-center gap-2">
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-neutral-300 hover:text-white transition-all"
            >
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>History</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            <span>MOSS READY</span>
          </div>
        </div>
      </div>

      {/* Centered Workspace Card */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full">
        <div className="w-full glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {/* Eyebrow and Headline */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full glass-badge text-neutral-300 text-[10px] font-mono tracking-wider uppercase mb-3">
              DOCUMENT INTAKE
            </div>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
              Give Tripwire something to verify.
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
              Upload a document or paste its text, then ask a question. Tripwire verifies the answer sentence by sentence as it streams.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex w-full bg-black/60 p-1 rounded-2xl mb-5 border border-white/15 backdrop-blur-xl">
            <button
              onClick={() => {
                setTabMode("upload");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-xl transition-all ${
                tabMode === "upload"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-white/80" />
              <span>Upload PDF</span>
            </button>
            <button
              onClick={() => {
                setTabMode("paste");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-lg transition-all ${
                tabMode === "paste"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-white/80" />
              <span>Paste text instead</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Indexing Progress Indicator */}
          {isLoading && (
            <div className="mb-6 p-4 rounded-2xl glass-card space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-white">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Processing document...</span>
                </span>
                <span className="text-[10px] text-neutral-400">Moss Engine</span>
              </div>

              {/* 4-step pipeline bar */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono">
                {[
                  { id: "reading", label: "Reading" },
                  { id: "splitting", label: "Splitting" },
                  { id: "indexing", label: "Indexing" },
                  { id: "ready", label: "Ready" },
                ].map((step, sIdx) => {
                  const stepIndex = ["reading", "splitting", "indexing", "ready"].indexOf(indexingStep);
                  const isDone = stepIndex > sIdx;
                  const isCurrent = stepIndex === sIdx;

                  return (
                    <div
                      key={step.id}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        isCurrent
                          ? "bg-white/25 border-white/50 text-white font-semibold shadow-sm backdrop-blur-md"
                          : isDone
                          ? "bg-white/[0.08] border-white/20 text-white/80"
                          : "bg-white/[0.02] border-white/[0.06] text-neutral-500"
                      }`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 1: Upload PDF */}
          {tabMode === "upload" && !isLoading && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[210px] group ${
                isDragOver
                  ? "border-white/60 bg-white/[0.08] backdrop-blur-xl"
                  : "border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.04] bg-black/30 backdrop-blur-md"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full glass-card border border-white/20 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-white/40 transition-all mb-3 shadow-md">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-white">
                Drop a PDF here
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                or browse from your device
              </p>
              <span className="text-[10px] text-neutral-500 mt-2 font-mono">
                Supports PDF, TXT (up to 20 pages / ~8,000 words)
              </span>
            </div>
          )}

          {/* Tab 2: Paste Text */}
          {tabMode === "paste" && !isLoading && (
            <div className="w-full flex flex-col gap-3">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste source material here (e.g. quarterly earnings report, legal contract, clinical study, product spec)..."
                rows={7}
                className="w-full p-3.5 rounded-2xl border border-white/15 bg-black/50 backdrop-blur-md text-xs sm:text-sm font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-white/40 transition-all resize-none shadow-inner"
              />
              <button
                disabled={isLoading || !pastedText.trim()}
                onClick={() => handleProcessPastedText(pastedText)}
                className="w-full py-3 px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:opacity-40 transition-all flex items-center justify-center gap-2 tactile-btn shadow-md"
              >
                <span>Continue &amp; Start Verification</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* One-Click Sample Document Demo Option */}
          <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
            <span className="text-[11px] text-neutral-500">No PDF on hand? Test the reference demo:</span>
            <button
              onClick={() => handleProcessPastedText(SAMPLE_DOCUMENT_TEXT, SAMPLE_DOCUMENT_TITLE)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-white hover:bg-white/[0.1] hover:border-white/30 transition-all text-xs font-medium tactile-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-white/80" />
              <span>Load Sample Q3 Financial Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="relative z-10 max-w-3xl mx-auto w-full pt-6 pb-2 text-center text-[11px] text-neutral-500 font-mono">
        <span>Tripwire Verification Pipeline · Sub-10ms Moss Vector Search · NLI Classifier</span>
      </div>
    </div>
  );
};