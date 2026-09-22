"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  X,
  Clock,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { StoredConversationSummary, listConversations, deleteConversation } from "@/lib/storage";

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewDocument: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  isOpen,
  onClose,
  activeConversationId,
  onSelectConversation,
  onNewDocument,
}) => {
  const [conversations, setConversations] = useState<StoredConversationSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshList = async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversation history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen) {
      listConversations()
        .then((list) => {
          if (active) {
            setConversations(list);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load conversation history:", err);
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, activeConversationId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this conversation and document?")) {
      await deleteConversation(id);
      await refreshList();
      if (activeConversationId === id) {
        onNewDocument();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 w-80 sm:w-96 glass-panel border-r border-white/15 z-50 flex flex-col shadow-2xl animate-blur-fade-up bg-black/80 backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/15 flex items-center justify-between bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white" />
            <span className="font-medium text-sm tracking-wide text-white font-sans">
              Saved Sessions &amp; Docs
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Document Action (Black/White/Warm styling - No Blue) */}
        <div className="p-3 border-b border-white/10">
          <button
            onClick={() => {
              onNewDocument();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-semibold tracking-wide transition-all shadow-md tactile-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Document / Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-xs text-neutral-500 font-mono">
              Loading history...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4 text-xs text-neutral-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-neutral-400" />
              <p className="font-medium text-neutral-300">No saved sessions yet</p>
              <p className="mt-1 text-[11px] opacity-70">
                Upload a document or ask a question to automatically save sessions.
              </p>
            </div>
          ) : (
            conversations.map((item) => {
              const isActive = item.id === activeConversationId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectConversation(item.id);
                    onClose();
                  }}
                  className={`group relative flex flex-col p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-white/20 border-white/40 text-white shadow-md backdrop-blur-md"
                      : "glass-card text-neutral-300 hover:bg-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-white" : "text-neutral-400"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium truncate ${
                          isActive ? "text-white" : "text-neutral-200"
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      title="Delete session"
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-400 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                    <div className="flex items-center gap-2">
                      <span>{item.documentMeta?.pageCount || 1} pgs</span>
                      <span>·</span>
                      <span>{item.turnCount} {item.turnCount === 1 ? "turn" : "turns"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{formatRelativeTime(item.updatedAt)}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-white/5 text-[10px] text-neutral-500 font-mono text-center">
          Persisted locally via IndexedDB
        </div>
      </aside>
    </>
  );
};
