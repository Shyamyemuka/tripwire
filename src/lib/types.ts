export type VerificationStatus = 'PENDING' | 'GREEN' | 'RED' | 'AMBER' | 'GREY';

export type RetrievalMode = 'moss' | 'baseline';

export interface ChunkRecord {
  chunkId: string;
  text: string;
  pageNumber: number;
  charOffsetStart: number;
  charOffsetEnd: number;
  mossVectorId?: string;
  embedding?: number[];
}

export interface CandidatePassage {
  chunkId: string;
  text: string;
  pageNumber: number;
  charOffsetStart: number;
  charOffsetEnd: number;
  similarityScore: number;
}

export interface SentenceVerificationRecord {
  sentenceId: string;
  text: string;
  status: VerificationStatus;
  matchedChunkId: string | null;
  matchedChunkText: string | null;
  topCandidates?: CandidatePassage[];
  similarityScore: number | null;
  retrievalLatencyMs: number;
  verdictLatencyMs: number | null;
  explanation: string | null;
  isExplained?: boolean;
}

export interface QATurn {
  turnId: string;
  questionText: string;
  mode: RetrievalMode;
  answerSentences: SentenceVerificationRecord[];
  isStreaming: boolean;
  error?: string | null;
}

export interface DocumentMeta {
  filename: string;
  pageCount: number;
  wordCount: number;
  truncated: boolean;
  truncatedPageRange?: string;
}

export interface SessionState {
  sessionId: string;
  documentMeta: DocumentMeta | null;
  chunks: ChunkRecord[];
  qaTurns: QATurn[];
  mode: RetrievalMode;
  totalClaimsVerified: number;
  avgRetrievalLatencyMs: number;
  isStressTestMode?: boolean;
}
