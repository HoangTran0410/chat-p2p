export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
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

export type PeerConnectionStatus = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
}