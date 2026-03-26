export enum Sender {
  USER = 'user',
  AI = 'ai'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  isStreaming?: boolean;
}

export interface UploadedFile {
  id: string; // Added unique ID for list management
  name: string;
  type: string;
  size: number;
  data: string; // Base64 string — kept in RAM only, never saved to Firestore
  mimeType: string;
}

/** Lightweight metadata saved to Firestore — NO Base64 data */
export interface FileMetadata {
  id: string;
  name: string;
}

export interface ChatState {
  isLoading: boolean;
  messages: Message[];
  files: UploadedFile[]; // Changed from file to files array
  error: string | null;
}

export interface UserProfile {
  email: string;
  chats_left: number;
  total_storage_kb: number;
}

/** A chat session document stored at users/{uid}/sessions/{sessionId} */
export interface Session {
  id: string;
  title: string;
  createdAt: number; // Unix ms timestamp
  files: FileMetadata[];
}

/** A message document stored at users/{uid}/sessions/{sessionId}/messages/{messageId} */
export interface SessionMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface HistoryEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// Error codes thrown by geminiService for modal routing
export const ERROR_LIMIT_REACHED = 'LIMIT_REACHED';
export const ERROR_STORAGE_LIMIT = 'STORAGE_LIMIT';
