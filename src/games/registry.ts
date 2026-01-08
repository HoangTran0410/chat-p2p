import { BaseGame } from "./BaseGame";
import { BaseRealTimeGame } from "./BaseRealTimeGame";
import { GameDefinition } from "./types";

// Type for game constructor - supports both turn-based and real-time games
type GameConstructor<TData = any, TMove = any> =
  | (new () => BaseGame<TData, TMove>)
  | (new () => BaseRealTimeGame<TData, TMove>);

/**
 * Registry of all available games
 * Games register their class (not instance) here for lazy loading
 */
class GameRegistry {
  private gameClasses = new Map<string, GameConstructor>();
  private gameDefinitionCache = new Map<string, GameDefinition>();

  /**
   * Register a game class (not instance)
   * Supports both BaseGame and BaseRealTimeGame
   */
  register<TData, TMove>(GameClass: GameConstructor<TData, TMove>): void {
    // Create temporary instance to get gameId and definition
    const tempInstance = new GameClass();
    const gameId = tempInstance.gameId;

    if (this.gameClasses.has(gameId)) {
      console.warn(`Game ${gameId} is already registered, skipping...`);
      return;
    }

    // Store class for lazy instantiation
    this.gameClasses.set(gameId, GameClass);

    // Cache definition for UI (no need to instantiate every time)
    this.gameDefinitionCache.set(gameId, tempInstance.getDefinition());
  }

  /**
   * Create a new instance of a game by its ID
   * Each call creates a fresh instance
   * Returns either BaseGame or BaseRealTimeGame instance
   */
  createInstance(
    gameId: string
  ): BaseGame<any, any> | BaseRealTimeGame<any, any> | null {
    const GameClass = this.gameClasses.get(gameId);
    if (!GameClass) {
      console.warn(`Game ${gameId} not found in registry`);
      return null;
    }
    return new GameClass();
  }

  /**
   * Get all game definitions (for UI display)
   * Uses cached definitions - no instantiation needed
   */
  getAllDefinitions(): GameDefinition[] {
    return Array.from(this.gameDefinitionCache.values());
  }

  /**
   * Check if a game is registered
   */
  has(gameId: string): boolean {
    return this.gameClasses.has(gameId);
  }

  /**
   * Get game definition by ID (cached)
   */
  getDefinition(gameId: string): GameDefinition | undefined {
    return this.gameDefinitionCache.get(gameId);
  }
}

// Singleton instance
export const gameRegistry = new GameRegistry();
