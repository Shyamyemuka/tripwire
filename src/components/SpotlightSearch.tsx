"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CandidatePassage } from "@/lib/types";
import {
  Search,
  Zap,
  Copy,
  Check,
  MessageSquare,
  X,
  FileText,
  Loader2,
} from "lucide-react";

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSelectForQuestion: (questionPrompt: string) => void;
}

export const SpotlightSearch: React.FC<SpotlightSearchProps> = ({
  isOpen,
  onClose,
  sessionId,
  onSelectForQuestion,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidatePassage[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setLatencyMs(null);
    }
  }

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Perform search with AbortController for stale requests
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setLatencyMs(null);
        setIsLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId,
            query: searchQuery,
            topK: 5,
          }),
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();
        if (data.candidates) {
          setResults(data.candidates);
          setLatencyMs(data.timeTakenInMs);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Request was aborted, ignore
        }
        console.warn("Spotlight search error:", err);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [sessionId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
        setLatencyMs(null);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  if (!isOpen) return null;

  const handleAskQuestion = (snippetText: string) => {
    const formattedQuestion = `What does the document state regarding: "${snippetText.slice(0, 150)}"?`;
    onSelectForQuestion(formattedQuestion);
    onClose();
  };

  const handleCopySnippet = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-fade-in"
      />

      {/* Spotlight Palette Container */}
      <div className="relative z-10 w-full max-w-2xl glass-panel border border-white/20 shadow-2xl rounded-2xl flex flex-col overflow-hidden backdrop-blur-2xl bg-black/90 animate-blur-fade-up">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/15 bg-white/[0.03]">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spotlight Search: type keywords or concepts across document..."
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          )}
          {query && !isLoading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-neutral-400 hover:text-white rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results / Empty state Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {/* Header Bar with Moss Latency Badge */}
          {results.length > 0 && latencyMs !== null && (
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 px-1 pb-1 border-b border-white/10">
              <span className="text-neutral-300 font-medium">
                {results.length} Matches Found
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                <Zap className="w-3 h-3 fill-current" />
                <span>{latencyMs < 1 ? "<1.0" : latencyMs.toFixed(1)}ms Moss</span>
              </div>
            </div>
          )}

          {/* Search Result Cards */}
          {results.map((item, idx) => {
            const cardId = item.chunkId || `${idx}`;
            const isCopied = copiedId === cardId;

            return (
              <div
                key={cardId}
                onClick={() => handleAskQuestion(item.text)}
                className="group p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="text-neutral-300 truncate">
                      {item.documentName ? `${item.documentName} · ` : ""}Page {item.pageNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-emerald-400 font-medium">
                      {(item.similarityScore * 100).toFixed(1)}% match
                    </span>

                    {/* Dual Quick Actions */}
                    <button
                      type="button"
                      onClick={(e) => handleCopySnippet(item.text, cardId, e)}
                      title="Copy snippet text"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAskQuestion(item.text);
                      }}
                      title="Ask Question in Chat"
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-sans font-medium text-[10px] flex items-center gap-1 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      <span>Ask Question</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed line-clamp-3">
                  {item.text}
                </p>
              </div>
            );
          })}

          {/* Empty Prompt State */}
          {!query && (
            <div className="py-10 text-center text-neutral-400 space-y-2">
              <Search className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-neutral-300">
                Sub-10ms In-Memory Semantic Spotlight Search
              </p>
              <p className="text-[11px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Type any keyword, requirement, or clause to perform real-time keystroke retrieval across document pages.
              </p>
            </div>
          )}

          {/* No Matches Found */}
          {query && !isLoading && results.length === 0 && (
            <div className="py-8 text-center text-neutral-500 text-xs">
              No matching passages found for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-neutral-300">
              Esc
            </kbd>
            <span>to close</span>
          </div>
          <span>Powered by Moss Zero Latency Vector Engine</span>
        </div>
      </div>
    </div>
  );
};
