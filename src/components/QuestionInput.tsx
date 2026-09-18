"use client";

import React, { useState } from 'react';
import { Send } from 'lucide-react';

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

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md p-4 sticky bottom-0 z-20">
      <div className="max-w-4xl mx-auto space-y-3">
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