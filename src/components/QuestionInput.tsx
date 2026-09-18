"use client";

import React, { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

interface QuestionInputProps {
  onSubmitQuestion: (question: string) => void;
  isStreaming: boolean;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({
  onSubmitQuestion,
  isStreaming,
}) => {
  const [question, setQuestion] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setValidationError("Ask a question before continuing.");
      return;
    }
    if (isStreaming) return;

    setValidationError(null);
    onSubmitQuestion(question.trim());
    setQuestion("");
  };

  return (
    <div className="border-t border-white/[0.08] bg-black/80 backdrop-blur-xl p-4 sm:p-5 sticky bottom-0 z-30 transition-colors">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Validation Error Message */}
        {validationError && (
          <div className="text-[11px] text-[#EF4444] font-medium px-2">
            {validationError}
          </div>
        )}

        {/* Input Container */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? "Answer streaming & verifying claim by claim..."
                : "Ask a question about this document..."
            }
            className="w-full pl-5 pr-14 py-3.5 rounded-full border border-white/10 bg-white/[0.03] text-sm text-white placeholder-white/40 focus:outline-hidden focus:border-white/40 focus:ring-1 focus:ring-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] disabled:opacity-50 transition-all font-sans"
          />

          <button
            type="submit"
            disabled={!question.trim() || isStreaming}
            aria-label="Submit Question"
            className="absolute right-2 p-2 rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-all tactile-btn flex items-center justify-center shadow-sm"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <ArrowUp className="w-4 h-4 text-black" />
            )}
          </button>
        </form>

        {/* Streaming feedback note */}
        {isStreaming && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-subtle-pulse" />
            <span>Streaming answer tokens · Executing independent Moss queries per sentence</span>
          </div>
        )}
      </div>
    </div>
  );
};