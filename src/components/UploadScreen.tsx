"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  FileText,
  Files,
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
  const [tabMode, setTabMode] = useState<"single" | "multi" | "paste">("single");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedNotes, setStagedNotes] = useState<Array<{ id: string; title: string; text: string }>>([]);
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [indexingStep, setIndexingStep] = useState<IndexingStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

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

  // Single-file immediate processing (smooth, 1-click UX)
  const handleProcessSingleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".txt") && !lower.endsWith(".md")) {
      setErrorMessage(`"${file.name}" has an unsupported format. Please upload PDF, TXT, or MD files.`);
      return;
    }

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
        throw new Error(data.error || "Failed to process document.");
      }
      onDocumentLoaded(data);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error processing document.";
      setErrorMessage(msg);
      setIndexingStep("idle");
    });
  };

  // Add files to multi-doc staging
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

    // Enforce combined staged item limit (Copilot Finding 4)
    const currentTotal = stagedFiles.length + stagedNotes.length;
    const maxCanAdd = Math.max(0, MAX_TOTAL_STAGED - currentTotal);

    if (newFiles.length > maxCanAdd) {
      setErrorMessage(`Maximum limit of ${MAX_TOTAL_STAGED} combined files and notes per session.`);
    }

    const filesToAdd = newFiles.slice(0, maxCanAdd);
    if (filesToAdd.length > 0) {
      setStagedFiles((prev) => [...prev, ...filesToAdd]);
    }
  };

  const handleAddStagedNote = () => {
    if (!pastedText.trim()) return;
    if (stagedFiles.length + stagedNotes.length >= MAX_TOTAL_STAGED) {
      setErrorMessage(`Maximum limit of ${MAX_TOTAL_STAGED} documents reached.`);
      return;
    }

    const title = pastedTitle.trim() || `Pasted Note ${stagedNotes.length + 1}`;
    setStagedNotes((prev) => [
      ...prev,
      { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, text: pastedText },
    ]);
    setPastedText("");
    setPastedTitle("");
    setErrorMessage(null);
    setTabMode("multi");
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveStagedNote = (id: string) => {
    setStagedNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Process all staged documents in multi-file mode
  const handleStartVerificationSession = async () => {
    if (stagedFiles.length === 0 && stagedNotes.length === 0) {
      if (pastedText.trim()) {
        handleAddStagedNote();
      } else {
        setErrorMessage("Please stage at least one file or text note to begin.");
        return;
      }
    }

    setErrorMessage(null);

    await simulateStepProgress(async () => {
      const formData = new FormData();
      stagedFiles.forEach((file) => formData.append("files", file));
      stagedNotes.forEach((note) => {
        formData.append("pastedTexts", note.text);
        formData.append("pastedTitles", note.title);
      });

      const res = await fetch("/api/session", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process documents.");
      }

      onDocumentLoaded(data);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error processing documents.";
      setErrorMessage(msg);
      setIndexingStep("idle");
    });
  };

  const handleProcessPastedTextSingle = async (text: string, title = "pasted-document.txt") => {
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

  // Drop handler for single file tab
  const handleSingleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      handleProcessSingleFile(files[0]);
    } else {
      // User dropped multiple files into single dropzone -> switch to multi
      handleAddFiles(files);
      setTabMode("multi");
    }
  };

  // Drop handler for multi file tab
  const handleMultiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const totalStagedCount = stagedFiles.length + stagedNotes.length;

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
              Upload documents or paste text, then ask a question. Tripwire verifies the answer sentence by sentence as it streams.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex w-full bg-black/60 p-1 rounded-2xl mb-5 border border-white/15 backdrop-blur-xl">
            <button
              onClick={() => {
                setTabMode("single");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-xl transition-all ${
                tabMode === "single"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-white/80" />
              <span>Single Doc</span>
            </button>
            <button
              onClick={() => {
                setTabMode("multi");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-xl transition-all ${
                tabMode === "multi"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Files className="w-3.5 h-3.5 text-white/80" />
              <span>Multi-Doc</span>
              {totalStagedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
                  {totalStagedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTabMode("paste");
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-xl transition-all ${
                tabMode === "paste"
                  ? "bg-white/15 text-white shadow-md border border-white/20 backdrop-blur-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileEdit className="w-3.5 h-3.5 text-white/80" />
              <span>Paste Text</span>
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

          {/* TAB 1: Single Document Upload (Clean, 1-Click Dropzone) */}
          {tabMode === "single" && !isLoading && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleSingleDrop}
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
                accept=".pdf,.txt,.md"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    if (e.target.files.length === 1) {
                      handleProcessSingleFile(e.target.files[0]);
                    } else {
                      handleAddFiles(e.target.files);
                      setTabMode("multi");
                    }
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl glass-card border border-white/20 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-white/40 transition-all mb-3 shadow-md group-hover:scale-105">
                <UploadCloud className="w-5 h-5 text-white/90" />
              </div>
              <p className="text-sm font-medium text-white">
                Drop a PDF or document here
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                or click to browse from your device
              </p>
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-neutral-400 font-mono">
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">PDF</span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">TXT</span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">MD</span>
                <span className="text-neutral-500">· up to 20 pages</span>
              </div>
            </div>
          )}

          {/* TAB 2: Multi-Document Upload (Clean Unified Staged Workspace) */}
          {tabMode === "multi" && !isLoading && (
            <div className="w-full space-y-3">
              {totalStagedCount === 0 ? (
                /* Empty Multi-Doc Dropzone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleMultiDrop}
                  onClick={() => multiFileInputRef.current?.click()}
                  className={`w-full border rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] group ${
                    isDragOver
                      ? "border-emerald-400/60 bg-emerald-500/[0.08] backdrop-blur-xl scale-[0.99]"
                      : "border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.04] bg-black/30 backdrop-blur-md"
                  }`}
                >
                  <input
                    ref={multiFileInputRef}
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
                    <Files className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-white">
                    Drop multiple documents here
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    or select multiple files (up to {MAX_TOTAL_STAGED} files)
                  </p>
                  <span className="text-[10px] text-neutral-500 mt-2 font-mono">
                    Combined cross-document retrieval · ~8,000 words max
                  </span>
                </div>
              ) : (
                /* Staged Documents Workspace (Clean List + Compact Mini-Drop Strip + Launch CTA) */
                <div className="p-4 rounded-2xl glass-card border border-white/15 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white pb-2 border-b border-white/10">
                    <span className="flex items-center gap-2 font-semibold">
                      <Files className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Staged Documents ({totalStagedCount}/{MAX_TOTAL_STAGED})</span>
                    </span>
                    <span className="text-[10px] text-neutral-400">Budget: ~8,000 words total</span>
                  </div>

                  {/* List of Staged Files and Notes */}
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {stagedFiles.map((file, idx) => (
                      <div
                        key={`file-${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-white font-mono truncate text-[11px]">{file.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveStagedFile(idx)}
                          className="text-neutral-400 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors ml-2"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {stagedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileEdit className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-white font-mono truncate text-[11px]">{note.title}</span>
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            ({note.text.split(/\s+/).filter(Boolean).length} words)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveStagedNote(note.id)}
                          className="text-neutral-400 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors ml-2"
                          title="Remove note"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Compact "+ Add more files" Strip */}
                  {totalStagedCount < MAX_TOTAL_STAGED && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleMultiDrop}
                      onClick={() => multiFileInputRef.current?.click()}
                      className={`w-full py-2.5 px-3 border border-dashed rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-2 text-xs ${
                        isDragOver
                          ? "border-emerald-400 bg-emerald-500/10 text-white"
                          : "border-white/20 hover:border-white/40 hover:bg-white/[0.04] text-neutral-300"
                      }`}
                    >
                      <input
                        ref={multiFileInputRef}
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
                      <span className="font-mono text-[11px]">+ Add more documents (PDF, TXT, MD)</span>
                    </div>
                  )}

                  {/* Primary Start Button */}
                  <button
                    onClick={handleStartVerificationSession}
                    className="w-full py-3 px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 tactile-btn shadow-md mt-2"
                  >
                    <span>Start Multi-Doc Verification ({totalStagedCount} {totalStagedCount === 1 ? "document" : "documents"})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Paste Text */}
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
              <div className="flex items-center gap-2">
                <button
                  disabled={!pastedText.trim() || totalStagedCount >= MAX_TOTAL_STAGED}
                  onClick={handleAddStagedNote}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Stage into Multi-Doc</span>
                </button>
                <button
                  disabled={isLoading || (!pastedText.trim() && totalStagedCount === 0)}
                  onClick={() => {
                    if (pastedText.trim()) {
                      handleProcessPastedTextSingle(pastedText, pastedTitle.trim() || "pasted-document.txt");
                    } else {
                      handleStartVerificationSession();
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:opacity-40 transition-all flex items-center justify-center gap-2 tactile-btn shadow-md"
                >
                  <span>Start Verification</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* One-Click Sample Document Demo Option */}
          <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
            <span className="text-[11px] text-neutral-500">No PDF on hand? Test the reference demo:</span>
            <button
              onClick={() => handleProcessPastedTextSingle(SAMPLE_DOCUMENT_TEXT, SAMPLE_DOCUMENT_TITLE)}
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