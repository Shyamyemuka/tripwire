"use client";

import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface QuestionInputProps {
  onSubmitQuestion: (question: string) => void;
  isStreaming: boolean;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({
  onSubmitQuestion,
  isStreaming
}) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isStreaming) return;
    onSubmitQuestion(question.trim());
    setQuestion('');
  };

  const handleSuggestion = (prompt: string) => {
    if (isStreaming) return;
    onSubmitQuestion(prompt);
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md p-4 sticky bottom-0 z-20">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Quick prompt suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-zinc-500">
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-zinc-400">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            Suggestions:
          </span>
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleSuggestion("Summarise the financial highlights.")}
            className="shrink-0 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            &quot;Summarise the financial highlights&quot;
          </button>
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleSuggestion("What were the operating costs and headcount changes?")}
            className="shrink-0 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            &quot;Operating costs &amp; headcount&quot;
          </button>
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleSuggestion("Did revenue decrease 30% from last year?")}
            className="shrink-0 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            &quot;Test planted contradiction&quot;
          </button>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? "Answer streaming & inline fact-checking in flight..."
                : "Ask a question about the uploaded document..."
            }
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 transition-all shadow-xs"
          />
          <button
            type="submit"
            disabled={!question.trim() || isStreaming}
            className="absolute right-2 p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};