import { ReactNode } from "react";
import { GameSession, GameDefinition } from "./types";

/**
 * Abstract base class for all P2P games using host-client architecture.
 *
 * Host-Client Model:
 * - Host: Runs main game logic (whoever creates the game)
 * - Client: Syncs state from host (whoever accepts the invite)
 *
 * Features:
 * - Event-driven: Only syncs when player takes action (minimal P2P traffic)
 * - Client-side prediction: Instant UI feedback despite network latency
 * - Universal: Works for ALL game types (turn-based, real-time, simultaneous)
 *
 * @example Turn-based game (TicTacToe, Chess)
 * class TicTacToe extends BaseGame<TicTacToeData, TicTacToeMove> {
 *   handleInput(state, input, playerId, isHost) {
 *     // Both host and client apply move optimistically
 *     // Host also validates and syncs authoritative state
 *   }
 * }
 *
 * @example Real-time game (Canvas, YouTube)
 * class Canvas extends BaseGame<CanvasData, DrawAction> {
 *   handleInput(state, input, playerId, isHost) {
 *     // Both host and client apply drawing immediately
 *     // Host syncs to keep in sync
 *   }
 * }
 */
export abstract class BaseGame<TGameData = Record<string, any>, TInput = any> {
  // ==================== Metadata ====================

  /**
   * Unique identifier for this game type
   */
  abstract readonly gameId: string;

  /**
   * Display name for the game
   */
  abstract readonly gameName: string;

  /**
   * Emoji or icon for the game
   */
  abstract readonly gameIcon: string;

  /**
   * Short description of the game
   */
  abstract readonly gameDescription: string;

  /**
   * Get the game definition
   */
  getDefinition(): GameDefinition {
    return {
      id: this.gameId,
      name: this.gameName,
      icon: this.gameIcon,
      description: this.gameDescription,
      minPlayers: 2,
      maxPlayers: 2,
    };
  }

  // ==================== State Management ====================

  /**
   * Create initial game state when game starts
   * Called by host when guest accepts invite
   */
  abstract createInitialState(hostId: string, clientId: string): TGameData;

  /**
   * Handle player input - THE MAIN METHOD
   *
   * Called when player takes action (click, draw, move, etc.)
   * This is event-driven - only called on user interaction, not continuously.
   *
   * CLIENT-SIDE PREDICTION:
   * - Both host AND client call this method and apply result immediately
   * - Client applies optimistically for instant UI feedback (no lag!)
   * - Client also sends input to host for validation
   * - Host processes, validates, and syncs authoritative state back
   * - Client reconciles when receiving authoritative state
   *
   * @param state Current game state
   * @param input Player input data
   * @param playerId Who performed the action
   * @param isHost Whether current player is the host
   * @returns Updated state (both host and client return new state)
   */
  abstract handleInput(
    state: GameSession<TGameData>,
    input: TInput,
    playerId: string,
    isHost: boolean
  ): GameSession<TGameData>;

  /**
   * Check if game has ended (OPTIONAL)
   * Called by host after each handleInput to determine win/draw/continue
   */
  checkGameEnd?(state: GameSession<TGameData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  };

  // ==================== Networking ====================

  /**
   * Get state snapshot for syncing to client (OPTIONAL)
   *
   * Override to optimize network traffic by sending only changed data.
   * Default: sends full state (simple but less efficient)
   *
   * @example Delta compression for Canvas
   * getStateSnapshot(state) {
   *   // Only send strokes added since last sync
   *   return { ...state, data: { newStrokes: [...] } };
   * }
   */
  getStateSnapshot(state: GameSession<TGameData>): GameSession<TGameData> {
    return state;
  }

  /**
   * Apply received state snapshot from host (OPTIONAL)
   *
   * Override for client-side interpolation or conflict resolution.
   * Default: replace entire state with authoritative state from host
   *
   * @example Smooth interpolation
   * applyStateSnapshot(currentState, snapshot) {
   *   // Interpolate between current and new state for smooth animation
   *   return interpolate(currentState, snapshot);
   * }
   */
  applyStateSnapshot(
    currentState: GameSession<TGameData>,
    snapshot: GameSession<TGameData>
  ): GameSession<TGameData> {
    return snapshot;
  }

  // ==================== UI Rendering ====================

  /**
   * Render the game UI
   *
   * @param state Current game state
   * @param myId Current player's ID
   * @param isHost Whether current player is host
   * @param onInput Callback to send input (call only when user takes action!)
   */
  abstract render(
    state: GameSession<TGameData>,
    myId: string,
    isHost: boolean,
    onInput: (input: TInput) => void
  ): ReactNode;
}
