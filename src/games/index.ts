// Game implementations index
// Import and register all games here

import { gameRegistry } from "./registry";
import { TicTacToeGame } from "./tictactoe";
import { CollaborativeCanvas } from "./canvas";
import { YouTubeSync } from "./youtube";
import { CaroGame } from "./caro";

// Register game classes (not instances)
gameRegistry.register(TicTacToeGame);
gameRegistry.register(CaroGame);
gameRegistry.register(CollaborativeCanvas);
gameRegistry.register(YouTubeSync);

// Export for convenience
export { gameRegistry } from "./registry";
export { BaseGame } from "./BaseGame";
export * from "./types";
