import { ReactNode } from "react";
import { GameSession, GameDefinition, RealTimeAction } from "./types";

/**
 * Abstract base class for real-time collaborative games.
 * Unlike turn-based games, both players can act simultaneously.
 * No turn system - actions are applied directly and synced via P2P.
 *
 * TGameData: Type of game-specific state data
 * TAction: Type of action payload for this game
 *
 * @example
 * class CollaborativeCanvas extends BaseRealTimeGame<CanvasData, DrawAction> {
 *   // implement abstract methods
 * }
 */
export abstract class BaseRealTimeGame<
  TGameData = Record<string, any>,
  TAction = any
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
      isRealTime: true,
    };
  }

  // ==================== State Management ====================

  /**
   * Create initial game state when game starts
   * Called by host when guest accepts invite
   */
  abstract createInitialState(hostId: string, guestId: string): TGameData;

  /**
   * Apply an action to the current state
   * Returns new state (immutable pattern)
   * Called on BOTH host and guest sides
   */
  abstract applyAction(
    state: GameSession<TGameData>,
    action: RealTimeAction<TAction>
  ): GameSession<TGameData>;

  /**
   * Optional: Check if game has ended
   * Real-time games may not have a clear end condition
   */
  checkGameEnd?(state: GameSession<TGameData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  };

  // ==================== UI Rendering ====================

  /**
   * Render the game UI
   * @param state Current game state
   * @param myId Current player's ID
   * @param onAction Callback when player performs an action
   */
  abstract renderGame(
    state: GameSession<TGameData>,
    myId: string,
    onAction: (payload: TAction) => void
  ): ReactNode;
}
