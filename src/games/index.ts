// Game implementations index
// Import and register all games here

import { gameRegistry } from "./registry";

import { TicTacToeGame } from "./tictactoe/TicTacToe";
import { CollaborativeCanvas } from "./canvas/Canvas";
import { YouTubeSync } from "./youtube/YouTube";
import { CaroGame } from "./caro/Caro";
import { ChessGame } from "./chess/Chess";

// Register game classes (not instances)
gameRegistry.register(TicTacToeGame);
gameRegistry.register(CaroGame);
gameRegistry.register(ChessGame);
gameRegistry.register(CollaborativeCanvas);
gameRegistry.register(YouTubeSync);

// Export for convenience
export { gameRegistry } from "./registry";
export { BaseGame } from "./BaseGame";
export * from "./types";
