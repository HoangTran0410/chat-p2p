export type MessageType = "text" | "image" | "video" | "file";

export interface Message {
  id: string;
  senderId: string;
  content: string; // Text content or Fallback text for files
  timestamp: number; // when message was sent
  receivedAt?: number; // when received by recipient
  readAt?: number; // when read by recipient
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  type?: MessageType;
  file?: {
    name: string;
    size: number;
    mimeType: string;
    data?: Blob | ArrayBuffer | string; // Blob for local/IDB, ArrayBuffer from PeerJS
  };
}

export interface ChatSession {
  peerId: string;
  name?: string; // Optional user-assigned nickname
  messages: Message[];
  lastUpdated: number;
  unreadCount: number;
}

export interface User {
  id: string;
  name: string;
}

// Multi-session support - each session is a separate identity
export interface UserSession {
  id: string; // Peer ID for this session
  name?: string; // Display name (e.g., "Work", "Personal")
  createdAt: number;
}

export type PeerConnectionStatus =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export interface PeerConfig {
  host: string;
  port: number;
  path: string;
  secure: boolean;
  debug?: number;
}

// File transfer constants
export const FILE_CHUNK_SIZE = 64 * 1024; // 64KB chunks
export const MAX_FILE_SIZE_WARNING = 50 * 1024 * 1024; // 50MB warning threshold

// Track ongoing file transfers
export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: Map<number, ArrayBuffer>;
  progress: number; // 0-100
  messageType: MessageType;
}
