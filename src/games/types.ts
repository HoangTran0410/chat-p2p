// ==================== Game Definition ====================

/**
 * Static definition of a game type (metadata)
 */
export interface GameDefinition {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

// ==================== Game Session State ====================

export type GameStatus = "waiting" | "playing" | "finished" | "cancelled";

/**
 * Runtime state of an active game session
 * Host manages authoritative state, client receives synced state
 */
export interface GameSession<TGameData = Record<string, any>> {
  id: string;
  gameType: string;
  hostId: string; // Player who created the game (runs main logic)
  clientId: string; // Player who joined (renamed from guestId)
  status: GameStatus;
  winner: string | null;
  isDraw: boolean;
  data: TGameData; // Game-specific state (games manage their own turn state if needed)
  createdAt: number;
  updatedAt: number;
}

// ==================== Game Input ====================

/**
 * Generic game input sent from player to host
 * Host processes and syncs authoritative state back
 */
export interface GameInput<TPayload = any> {
  playerId: string;
  timestamp: number;
  payload: TPayload; // Game-specific input data
}

// ==================== P2P Game Messages ====================

export type GameMessageType =
  | "game_invite"
  | "game_accept"
  | "game_decline"
  | "game_input" // Player sends input to host
  | "game_state_sync" // Host sends state to client
  | "game_leave"
  | "game_rematch";

export interface GameInviteMessage {
  type: "game_invite";
  gameType: string;
  sessionId: string;
  hostId: string;
}

export interface GameAcceptMessage {
  type: "game_accept";
  sessionId: string;
}

export interface GameDeclineMessage {
  type: "game_decline";
  sessionId: string;
}

export interface GameInputMessage {
  type: "game_input";
  sessionId: string;
  playerId: string;
  input: any; // Game-specific input payload
}

export interface GameStateSyncMessage {
  type: "game_state_sync";
  sessionId: string;
  state: GameSession;
}

export interface GameLeaveMessage {
  type: "game_leave";
  sessionId: string;
}

export interface GameRematchMessage {
  type: "game_rematch";
  sessionId: string;
  newSessionId: string;
}

export type GameMessage =
  | GameInviteMessage
  | GameAcceptMessage
  | GameDeclineMessage
  | GameInputMessage
  | GameStateSyncMessage
  | GameLeaveMessage
  | GameRematchMessage;

// ==================== Game Invite ====================

export interface PendingGameInvite {
  sessionId: string;
  gameType: string;
  hostId: string;
  receivedAt: number;
}
