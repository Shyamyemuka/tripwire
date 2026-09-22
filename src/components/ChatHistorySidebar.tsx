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
      {/* Backdrop with soft blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer: Transparent with Glassmorphism */}
      <aside className="fixed inset-y-0 right-0 w-85 sm:w-96 glass-panel border-l border-white/15 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.7)] animate-slide-in-right bg-black/40 backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/15 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-sm tracking-wide text-white font-sans">
              Saved Sessions &amp; Docs
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Document Action */}
        <div className="p-3 border-b border-white/10 bg-white/[0.01]">
          <button
            onClick={() => {
              onNewDocument();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold tracking-wide transition-all shadow-sm backdrop-blur-md tactile-btn"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>+ New Document / Chat</span>
          </button>
        </div>

        {/* Conversations List - Glassmorphic Cards ("Boxes") */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading ? (
            <div className="text-center py-10 text-xs text-neutral-400 font-mono">
              Loading history...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4 text-xs text-neutral-400 p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-neutral-400" />
              <p className="font-medium text-neutral-300">No saved sessions yet</p>
              <p className="mt-1 text-[11px] opacity-70">
                Upload documents and ask questions to automatically save sessions.
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
                  className={`group relative flex flex-col p-3.5 rounded-2xl border transition-all cursor-pointer backdrop-blur-xl ${
                    isActive
                      ? "bg-white/[0.12] border-white/30 text-white shadow-[0_4px_20px_rgba(255,255,255,0.06)] ring-1 ring-white/20"
                      : "bg-white/[0.03] border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.07] hover:border-white/25 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                        <FileText
                          className={`w-3.5 h-3.5 ${
                            isActive ? "text-white" : "text-emerald-400"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium truncate ${
                          isActive ? "text-white font-semibold" : "text-neutral-200"
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      title="Delete session"
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
                        {item.documentMeta?.documents && item.documentMeta.documents.length > 1
                          ? `${item.documentMeta.documents.length} docs`
                          : `${item.documentMeta?.pageCount || 1} pgs`}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
                        {item.turnCount} {item.turnCount === 1 ? "turn" : "turns"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500">
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
        <div className="p-3 border-t border-white/10 text-[10px] text-neutral-500 font-mono text-center bg-white/[0.02]">
          Persisted locally via IndexedDB
        </div>
      </aside>
    </>
  );
};
