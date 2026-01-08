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
  isRealTime?: boolean; // true for real-time games, false/undefined for turn-based
}

// ==================== Game Session State ====================

export type GameStatus = "waiting" | "playing" | "finished" | "cancelled";

/**
 * Runtime state of an active game session
 * Host manages authoritative state, guest receives synced state
 */
export interface GameSession<TGameData = Record<string, any>> {
  id: string;
  gameType: string;
  hostId: string; // Player who created the game (runs main logic)
  guestId: string; // Player who joined
  status: GameStatus;
  currentTurn: string; // Player ID whose turn it is
  winner: string | null;
  isDraw: boolean;
  data: TGameData; // Game-specific state
  createdAt: number;
  updatedAt: number;
}

// ==================== Game Actions ====================

/**
 * Base interface for all game actions
 */
export interface GameAction {
  type: string;
  playerId: string;
  timestamp: number;
}

/**
 * Action with game-specific payload
 */
export interface GameMoveAction<TPayload = any> extends GameAction {
  type: "move";
  payload: TPayload;
}

/**
 * Real-time action (no turn validation)
 * Used by BaseRealTimeGame
 */
export interface RealTimeAction<TPayload = any> {
  type: string; // flexible - "draw", "paint", "cursor_move", etc.
  playerId: string;
  timestamp: number;
  payload: TPayload;
}

// ==================== P2P Game Messages ====================

export type GameMessageType =
  | "game_invite"
  | "game_accept"
  | "game_decline"
  | "game_action"
  | "game_state_sync"
  | "game_leave"
  | "game_rematch"
  | "game_realtime_action";

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

export interface GameActionMessage {
  type: "game_action";
  sessionId: string;
  action: GameAction;
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

export interface GameRealTimeActionMessage {
  type: "game_realtime_action";
  sessionId: string;
  action: RealTimeAction;
}

export type GameMessage =
  | GameInviteMessage
  | GameAcceptMessage
  | GameDeclineMessage
  | GameActionMessage
  | GameStateSyncMessage
  | GameLeaveMessage
  | GameRematchMessage
  | GameRealTimeActionMessage;

// ==================== Game Invite ====================

export interface PendingGameInvite {
  sessionId: string;
  gameType: string;
  hostId: string;
  receivedAt: number;
}
