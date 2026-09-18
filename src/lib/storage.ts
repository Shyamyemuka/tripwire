import { ChunkRecord, DocumentMeta, QATurn, RetrievalMode } from './types';

export interface StoredConversation {
  id: string;
  title: string;
  filename: string;
  documentFullText: string;
  documentMeta: DocumentMeta;
  chunks: ChunkRecord[];
  qaTurns: QATurn[];
  mode: RetrievalMode;
  totalClaimsVerified: number;
  totalRetrievalLatencyMs: number;
  lastRetrievalLatencyMs: number | null;
  createdAt: number;
  updatedAt: number;
}

export type StoredConversationSummary = Pick<
  StoredConversation,
  'id' | 'title' | 'filename' | 'documentMeta' | 'createdAt' | 'updatedAt'
> & {
  turnCount: number;
};

const DB_NAME = 'tripwire_db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported or unavailable.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(conv: StoredConversation): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(conv);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save conversation to IndexedDB:', err);
  }
}

export async function getConversation(id: string): Promise<StoredConversation | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to read conversation from IndexedDB:', err);
    return null;
  }
}

export async function listConversations(): Promise<StoredConversationSummary[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all: StoredConversation[] = req.result || [];
        const summaries: StoredConversationSummary[] = all
          .map((c) => ({
            id: c.id,
            title: c.title || c.filename || 'Untitled Document',
            filename: c.filename || 'Document',
            documentMeta: c.documentMeta,
            turnCount: c.qaTurns ? c.qaTurns.length : 0,
            createdAt: c.createdAt || Date.now(),
            updatedAt: c.updatedAt || Date.now(),
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);

        resolve(summaries);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to list conversations from IndexedDB:', err);
    return [];
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete conversation from IndexedDB:', err);
  }
}
