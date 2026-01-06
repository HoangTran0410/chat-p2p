import { Message } from "./types";

// ==================== Room/Group Chat Types ====================

// Room member
export interface RoomMember {
  peerId: string;
  name?: string;
  joinedAt: number;
  priority: number; // Lower = higher priority for host migration (join order)
  isHost: boolean;
  isOnline: boolean;
}

// Room session state
export interface RoomSession {
  roomId: string; // Format: "room-{hostPeerId}" or custom
  name: string;
  hostId: string; // Current host peer ID
  originalHostId: string; // Creator's peer ID (for room identification)
  members: RoomMember[];
  messages: Message[];
  createdAt: number;
  lastUpdated: number;
}

// Room protocol message types
export type RoomProtocolType =
  | "room_join_request" // Member requests to join
  | "room_join_accept" // Host accepts member
  | "room_join_reject" // Host rejects member
  | "room_message" // Chat message (relayed by host)
  | "room_member_joined" // Broadcast: new member joined
  | "room_member_left" // Broadcast: member left
  | "room_members_update" // Sync member list
  | "room_host_changed" // Host migration notification
  | "room_close" // Room closed
  | "room_ping" // Heartbeat
  | "room_pong" // Heartbeat response
  | "room_history"; // Sync message history to new member

export interface RoomProtocolMessage {
  type: RoomProtocolType;
  roomId: string;
  senderId: string;
  payload: any;
  timestamp: number;
}

// Room join request payload
export interface RoomJoinRequestPayload {
  name?: string; // Optional display name
}

// Room join accept payload
export interface RoomJoinAcceptPayload {
  roomName: string;
  members: RoomMember[];
  messages: Message[];
  yourPriority: number;
}

// Room message payload
export interface RoomMessagePayload {
  messageId: string;
  content: string;
  type: "text" | "image" | "video" | "file";
  file?: {
    name: string;
    size: number;
    mimeType: string;
    data?: Blob | ArrayBuffer | string;
  };
}

// Room member joined/left payload
export interface RoomMemberEventPayload {
  member: RoomMember;
}

// Host change payload
export interface RoomHostChangedPayload {
  newHostId: string;
  newHostPeerId: string; // Peer ID to connect to
  members: RoomMember[];
}

// Constants
export const ROOM_PING_INTERVAL = 5000; // 5 seconds
export const ROOM_PING_TIMEOUT = 15000; // 15 seconds to consider host offline
export const MAX_ROOM_MEMBERS = 50;
