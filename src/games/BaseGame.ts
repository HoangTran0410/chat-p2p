import { ReactNode } from "react";
import {
  GameSession,
  GameAction,
  GameDefinition,
  GameMoveAction,
} from "./types";

/**
 * Abstract base class for all P2P games.
 * Each game implementation must extend this class.
 *
 * TGameData: Type of game-specific state data
 * TMovePayload: Type of move payload for this game
 *
 * @example
 * class TicTacToe extends BaseGame<TicTacToeData, TicTacToeMove> {
 *   // implement abstract methods
 * }
 */
export abstract class BaseGame<
  TGameData = Record<string, any>,
  TMovePayload = any
> {
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
  abstract createInitialState(hostId: string, guestId: string): TGameData;

  /**
   * Apply a move action to the current state
   * Returns new state (immutable pattern)
   * Only called on HOST side
   */
  abstract applyMove(
    state: GameSession<TGameData>,
    action: GameMoveAction<TMovePayload>
  ): GameSession<TGameData>;

  /**
   * Validate if a move is legal
   * Check player turn, game rules, etc.
   */
  abstract isValidMove(
    state: GameSession<TGameData>,
    action: GameMoveAction<TMovePayload>
  ): boolean;

  /**
   * Check if game has ended
   * Returns winner ID, null if no winner yet, or 'draw' for draw
   */
  abstract checkGameEnd(state: GameSession<TGameData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  };

  // ==================== UI Rendering ====================

  /**
   * Render the game UI
   * @param state Current game state
   * @param myId Current player's ID
   * @param onMove Callback when player makes a move
   * @param isMyTurn Whether it's current player's turn
   */
  abstract renderGame(
    state: GameSession<TGameData>,
    myId: string,
    onMove: (payload: TMovePayload) => void,
    isMyTurn: boolean
  ): ReactNode;

  // ==================== Helpers ====================

  /**
   * Get next player's turn
   */
  getNextTurn(state: GameSession<TGameData>): string {
    return state.currentTurn === state.hostId ? state.guestId : state.hostId;
  }

  /**
   * Check if it's a specific player's turn
   */
  isPlayerTurn(state: GameSession<TGameData>, playerId: string): boolean {
    return state.currentTurn === playerId && state.status === "playing";
  }
}
