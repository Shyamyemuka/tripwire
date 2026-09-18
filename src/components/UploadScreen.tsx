"use client";

import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { SAMPLE_DOCUMENT_TITLE, SAMPLE_DOCUMENT_TEXT } from '@/lib/sample-doc';
import { ChunkRecord, DocumentMeta } from '@/lib/types';

interface UploadScreenProps {
  onDocumentLoaded: (data: {
    sessionId: string;
    documentMeta: DocumentMeta;
    chunks: ChunkRecord[];
    documentFullText: string;
  }) => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onDocumentLoaded }) => {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process file');
      }

      onDocumentLoaded(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing document';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPastedText = async (text: string, title = 'pasted-document.txt') => {
    if (!text.trim()) {
      setErrorMessage('Please paste document text before proceeding.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename: title }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process text');
      }

      onDocumentLoaded(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing text';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          Moss Sub-10ms Fast Verification
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
          Tripwire
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Inline, sentence-level hallucination detection for streaming LLM outputs. Fact-checked against source material as it generates.
        </p>
      </div>

      {/* Mode switcher tabs */}
      <div className="flex w-full bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl mb-4 border border-zinc-200 dark:border-zinc-700/50">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
            mode === 'upload'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document (PDF / TXT)
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
            mode === 'paste'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Paste Plain Text
        </button>
      </div>

      {errorMessage && (
        <div className="w-full mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {mode === 'upload' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30'
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
          <div className="w-12 h-12 rounded-full bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {isLoading ? 'Indexing document into Moss...' : 'Drop your document here, or click to browse'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Supports PDF, TXT (up to 20 pages / ~8,000 words)
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste your source document content here (e.g. quarterly report, legal agreement, technical spec)..."
            rows={8}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            disabled={isLoading || !pastedText.trim()}
            onClick={() => handleProcessPastedText(pastedText)}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? 'Indexing document...' : 'Index Text & Start Verification'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* One-click demo document button */}
      <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <span>No file on hand? Test the reference demo:</span>
        <button
          onClick={() => handleProcessPastedText(SAMPLE_DOCUMENT_TEXT, SAMPLE_DOCUMENT_TITLE)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          Load Sample Q3 Financial Report
        </button>
      </div>
    </div>
  );
};