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
  // E2EE fields
  encrypted?: boolean; // true if message was encrypted
  encryptedPayload?: EncryptedPayload; // Only present in transit, not stored
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

// ==================== E2EE Types ====================

export interface EncryptedPayload {
  iv: string; // Base64 encoded IV (12 bytes for GCM)
  ciphertext: string; // Base64 encoded ciphertext + auth tag
}

export interface KeyExchangeMessage {
  type: "key_exchange";
  identityPubKey: JsonWebKey;
  sessionPubKey: JsonWebKey;
  signature: string;
}

export interface PeerKeyInfo {
  peerId: string;
  identityPubKey: JsonWebKey;
  fingerprint: string;
  firstSeen: number;
  lastSeen: number;
  verified: boolean; // User has manually verified this peer
}

export interface StoredIdentityKeys {
  sessionId: string; // Our session ID
  identityPubKey: JsonWebKey;
  identityPrivKey: JsonWebKey;
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
