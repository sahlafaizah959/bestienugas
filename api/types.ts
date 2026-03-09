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
  data: string; // Base64 string
  mimeType: string;
}

export interface ChatState {
  isLoading: boolean;
  messages: Message[];
  files: UploadedFile[]; // Changed from file to files array
  error: string | null;
}