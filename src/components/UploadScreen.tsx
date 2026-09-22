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
  Plus,
  X,
  FileEdit,
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
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [indexingStep, setIndexingStep] = useState<IndexingStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

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

  const MAX_TOTAL_STAGED = 5;

  // Add files to staging (supports 1 or multiple files in the same flow)
  const handleAddFiles = (files: FileList | File[]) => {
    setErrorMessage(null);
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pdf") && !lower.endsWith(".txt") && !lower.endsWith(".md")) {
        setErrorMessage(`"${file.name}" has an unsupported format. Please upload PDF, TXT, or MD files.`);
        continue;
      }
      newFiles.push(file);
    }

    const currentTotal = stagedFiles.length;
    const maxCanAdd = Math.max(0, MAX_TOTAL_STAGED - currentTotal);

    if (newFiles.length > maxCanAdd) {
      setErrorMessage(`Maximum limit of ${MAX_TOTAL_STAGED} files per verification session.`);
    }

    const filesToAdd = newFiles.slice(0, maxCanAdd);
    if (filesToAdd.length > 0) {
      setStagedFiles((prev) => [...prev, ...filesToAdd]);
    }
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Start verification for staged documents (single or multiple)
  const handleStartVerification = async () => {
    if (stagedFiles.length === 0) {
      setErrorMessage("Please select or drop at least one document to start verification.");
      return;
    }

    setErrorMessage(null);

    await simulateStepProgress(async () => {
      const formData = new FormData();
      if (stagedFiles.length === 1) {
        formData.append("file", stagedFiles[0]);
      } else {
        stagedFiles.forEach((file) => formData.append("files", file));
      }

      const res = await fetch("/api/session", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process document(s).");
      }

      onDocumentLoaded(data);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error processing document(s).";
      setErrorMessage(msg);
      setIndexingStep("idle");
    });
  };

  // Start verification for pasted text
  const handleProcessPastedText = async (text: string, title = "pasted-document.txt") => {
    if (!text.trim()) {
      setErrorMessage("Please paste or provide document text before starting verification.");
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
      handleAddFiles(e.dataTransfer.files);
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
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-neutral-300 hover:text-white transition-all cursor-pointer"
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
              Upload documents or paste text, then start verification. Tripwire checks answers sentence by sentence against your source material.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex w-full bg-black/60 p-1 rounded-2xl mb-5 border border-white/15 backdrop-blur-xl">
            <button
              onClick={() => {
                setTabMode("upload");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                tabMode === "upload"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-white/80" />
              <span>Upload Document(s)</span>
              {stagedFiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
                  {stagedFiles.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTabMode("paste");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                tabMode === "paste"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileEdit className="w-3.5 h-3.5 text-white/80" />
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
                  <span>Processing document(s)...</span>
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

          {/* TAB 1: Unified Document Upload (Single & Multiple in the SAME section) */}
          {tabMode === "upload" && !isLoading && (
            <div className="w-full space-y-4">
              {stagedFiles.length === 0 ? (
                /* Empty Dropzone State */
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] group ${
                      isDragOver
                        ? "border-white/60 bg-white/[0.08] backdrop-blur-xl scale-[0.99]"
                        : "border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.04] bg-black/30 backdrop-blur-md"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleAddFiles(e.target.files);
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-2xl glass-card border border-white/20 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-white/40 transition-all mb-3 shadow-md group-hover:scale-105">
                      <UploadCloud className="w-5 h-5 text-white/90" />
                    </div>
                    <p className="text-sm font-medium text-white">
                      Drop document(s) here or browse
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Upload one or multiple files (PDF, TXT, MD up to {MAX_TOTAL_STAGED})
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-neutral-400 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">PDF</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">TXT</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">MD</span>
                      <span className="text-neutral-500">· up to 20 pages combined</span>
                    </div>
                  </div>

                  {/* Start Verification Button (Disabled prompt when no files selected) */}
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl bg-white/10 border border-white/15 text-neutral-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Select or drop documents above to start verification</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                </>
              ) : (
                /* Staged Documents State with Start Verification Button */
                <div className="p-4 rounded-2xl glass-card border border-white/15 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white pb-2 border-b border-white/10">
                    <span className="flex items-center gap-2 font-semibold">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Selected Documents ({stagedFiles.length}/{MAX_TOTAL_STAGED})
                      </span>
                    </span>
                    <span className="text-[10px] text-neutral-400">Budget: ~8,000 words max</span>
                  </div>

                  {/* List of Staged Files */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {stagedFiles.map((file, idx) => (
                      <div
                        key={`file-${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                            <FileText className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white font-mono truncate text-[11px]">{file.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveStagedFile(idx)}
                          className="text-neutral-400 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors ml-2 cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Compact "+ Add more documents" Strip */}
                  {stagedFiles.length < MAX_TOTAL_STAGED && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => addMoreInputRef.current?.click()}
                      className={`w-full py-2.5 px-3 border border-dashed rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-2 text-xs ${
                        isDragOver
                          ? "border-emerald-400 bg-emerald-500/10 text-white"
                          : "border-white/20 hover:border-white/40 hover:bg-white/[0.04] text-neutral-300"
                      }`}
                    >
                      <input
                        ref={addMoreInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.txt,.md"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleAddFiles(e.target.files);
                          }
                        }}
                      />
                      <Plus className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="font-mono text-[11px]">+ Add another document (PDF, TXT, MD)</span>
                    </div>
                  )}

                  {/* Prominent Primary Start Verification Button */}
                  <button
                    onClick={handleStartVerification}
                    className="w-full mt-2 py-3.5 px-4 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 tactile-btn shadow-lg cursor-pointer"
                  >
                    <span>
                      Start Verification ({stagedFiles.length}{" "}
                      {stagedFiles.length === 1 ? "document" : "documents"})
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Paste Text */}
          {tabMode === "paste" && !isLoading && (
            <div className="w-full flex flex-col gap-3">
              <input
                type="text"
                value={pastedTitle}
                onChange={(e) => setPastedTitle(e.target.value)}
                placeholder="Document / Note Title (e.g. Errata Memo, Executive Summary)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/60 text-xs font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-white/30 transition-all"
              />
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste source material here (e.g. quarterly earnings report, legal contract, clinical study, product spec)..."
                rows={6}
                className="w-full p-3.5 rounded-2xl border border-white/15 bg-black/50 backdrop-blur-md text-xs sm:text-sm font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-white/40 transition-all resize-none shadow-inner"
              />
              <button
                disabled={isLoading || !pastedText.trim()}
                onClick={() =>
                  handleProcessPastedText(pastedText, pastedTitle.trim() || "pasted-document.txt")
                }
                className="w-full py-3.5 px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:opacity-40 transition-all flex items-center justify-center gap-2 tactile-btn shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Start Verification</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-white hover:bg-white/[0.1] hover:border-white/30 transition-all text-xs font-medium tactile-btn cursor-pointer"
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