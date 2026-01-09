import { BaseGame } from "../BaseGame";
import { GameSession } from "../types";
import { Chess } from "chess.js";
import React from "react";
import { ChessUI } from "./ChessUI";

// Game state
export interface ChessData {
  fen: string; // Current position in FEN notation
  moveHistory: string[]; // Array of moves in SAN notation
  capturedPieces: {
    white: string[];
    black: string[];
  };
  pendingUndoRequest: string | null; // Player ID who requested undo
  pendingNewGameRequest: string | null; // Player ID who requested new game
}

// Input payload
export interface ChessInput {
  action:
    | "move"
    | "undoRequest"
    | "undoConfirm"
    | "undoDecline"
    | "newGameRequest"
    | "newGameConfirm"
    | "newGameDecline";
  from?: string; // e.g., "e2"
  to?: string; // e.g., "e4"
  promotion?: "q" | "r" | "b" | "n"; // Promotion piece
}

export class ChessGame extends BaseGame<ChessData, ChessInput> {
  readonly gameId = "chess";
  readonly gameName = "Chess";
  readonly gameIcon = "👑";
  readonly gameDescription = "Classic chess game";

  createInitialState(hostId: string, clientId: string): ChessData {
    const chess = new Chess();
    return {
      fen: chess.fen(), // Standard starting position
      moveHistory: [],
      capturedPieces: {
        white: [],
        black: [],
      },
      pendingUndoRequest: null,
      pendingNewGameRequest: null,
    };
  }

  handleInput(
    state: GameSession<ChessData>,
    input: ChessInput,
    playerId: string,
    isHost: boolean
  ): GameSession<ChessData> {
    // Handle undo request
    if (input.action === "undoRequest") {
      // Cannot request undo if no moves or already pending
      if (
        state.data.moveHistory.length === 0 ||
        state.data.pendingUndoRequest
      ) {
        return state;
      }

      // Can only request undo for your own last move?
      // Actually, standard is: Request undo of the last move made.
      // If I just moved, it's opponent's turn. I want to undo.
      // If opponent just moved, I want to ask them to undo? No, I ask to undo *my* mistake.
      // Logic: Allow requesting undo at any time if valid.

      return {
        ...state,
        data: {
          ...state.data,
          pendingUndoRequest: playerId,
        },
        updatedAt: Date.now(),
      };
    }

    if (input.action === "undoConfirm") {
      // Only the OTHER player can confirm
      if (
        !state.data.pendingUndoRequest ||
        playerId === state.data.pendingUndoRequest
      ) {
        return state;
      }

      // Revert state by replaying game without last move
      const history = state.data.moveHistory;
      if (history.length === 0) return state;

      const newHistory = history.slice(0, -1);
      const replayChess = new Chess();

      // Replay all moves
      newHistory.forEach((move) => {
        replayChess.move(move);
      });

      // Calculate captured pieces from scratch
      const capturedWhite: string[] = [];
      const capturedBlack: string[] = [];

      const replayChessForCaptures = new Chess();
      newHistory.forEach((moveSan) => {
        const move = replayChessForCaptures.move(moveSan);
        if (move && move.captured) {
          // Re-apply logic: If White moved and captured, it goes to White's list
          const capturerColor = move.color === "w" ? "white" : "black";
          if (capturerColor === "white") capturedWhite.push(move.captured);
          else capturedBlack.push(move.captured);
        }
      });

      return {
        ...state,
        data: {
          fen: replayChess.fen(),
          moveHistory: newHistory,
          capturedPieces: {
            white: capturedWhite,
            black: capturedBlack,
          },
          pendingUndoRequest: null,
          pendingNewGameRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    if (input.action === "undoDecline") {
      // Only the OTHER player can decline (or the requester can cancel?)
      // Let's allow the other player to decline
      if (
        !state.data.pendingUndoRequest ||
        playerId === state.data.pendingUndoRequest
      ) {
        return state;
      }

      return {
        ...state,
        data: {
          ...state.data,
          pendingUndoRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    if (input.action === "newGameRequest") {
      // Cannot request new game if already pending
      if (state.data.pendingNewGameRequest) {
        return state;
      }

      return {
        ...state,
        data: {
          ...state.data,
          pendingNewGameRequest: playerId,
        },
        updatedAt: Date.now(),
      };
    }

    if (input.action === "newGameConfirm") {
      // Only the OTHER player can confirm
      if (
        !state.data.pendingNewGameRequest ||
        playerId === state.data.pendingNewGameRequest
      ) {
        return state;
      }

      // Reset game
      const chess = new Chess();
      return {
        ...state,
        data: {
          fen: chess.fen(),
          moveHistory: [],
          capturedPieces: {
            white: [],
            black: [],
          },
          pendingUndoRequest: null,
          pendingNewGameRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    if (input.action === "newGameDecline") {
      // Only the OTHER player can decline
      if (
        !state.data.pendingNewGameRequest ||
        playerId === state.data.pendingNewGameRequest
      ) {
        return state;
      }

      return {
        ...state,
        data: {
          ...state.data,
          pendingNewGameRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    // Handle move action
    if (input.action === "move") {
      const { from, to, promotion } = input;
      if (!from || !to) return state;

      // Load current position
      const chess = new Chess(state.data.fen);

      // Check if it's the player's turn
      const currentTurn = chess.turn() === "w" ? state.hostId : state.clientId;
      if (playerId !== currentTurn) return state;

      // Attempt move
      try {
        const move = chess.move({
          from,
          to,
          promotion: (promotion || "q") as "q" | "r" | "b" | "n", // Default to queen promotion
        });

        if (!move) return state; // Invalid move

        // Track captured piece
        const newCapturedPieces = { ...state.data.capturedPieces };
        if (move.captured) {
          // If white moved ('w'), they captured a black piece. Add to white's captured list.
          // If black moved ('b'), they captured a white piece. Add to black's captured list.
          const capturerColor = move.color === "w" ? "white" : "black";
          newCapturedPieces[capturerColor].push(move.captured);
        }

        return {
          ...state,
          data: {
            fen: chess.fen(),
            moveHistory: [...state.data.moveHistory, move.san],
            capturedPieces: newCapturedPieces,
            pendingUndoRequest: state.data.pendingUndoRequest, // Preserve pending request or clear? Let's preserve for now, or clear. Clearing seems safer as state changed.
            pendingNewGameRequest: state.data.pendingNewGameRequest,
          },
          updatedAt: Date.now(),
        };
      } catch (error) {
        // Invalid move
        return state;
      }
    }

    return state;
  }

  checkGameEnd(state: GameSession<ChessData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  } {
    const chess = new Chess(state.data.fen);

    // Checkmate
    if (chess.isCheckmate()) {
      // Winner is the player who just moved (opposite of current turn)
      const winnerId = chess.turn() === "w" ? state.clientId : state.hostId;
      return { isEnded: true, winner: winnerId, isDraw: false };
    }

    // Draw conditions
    if (
      chess.isStalemate() ||
      chess.isThreefoldRepetition() ||
      chess.isInsufficientMaterial() ||
      chess.isDraw()
    ) {
      return { isEnded: true, winner: null, isDraw: true };
    }

    return { isEnded: false, winner: null, isDraw: false };
  }

  render(
    state: GameSession<ChessData>,
    myId: string,
    isHost: boolean,
    onInput: (input: ChessInput) => void
  ): React.ReactNode {
    const chess = new Chess(state.data.fen);
    const isMyTurn =
      (chess.turn() === "w" && myId === state.hostId) ||
      (chess.turn() === "b" && myId === state.clientId);

    return React.createElement(ChessUI, {
      state,
      myId,
      isHost,
      isMyTurn,
      chess,
      onMove: (from: string, to: string, promotion?: string) =>
        onInput({
          action: "move",
          from,
          to,
          promotion: promotion as "q" | "r" | "b" | "n" | undefined,
        }),
      onUndoRequest: () => onInput({ action: "undoRequest" }),
      onUndoConfirm: () => onInput({ action: "undoConfirm" }),
      onUndoDecline: () => onInput({ action: "undoDecline" }),
      onNewGameRequest: () => onInput({ action: "newGameRequest" }),
      onNewGameConfirm: () => onInput({ action: "newGameConfirm" }),
      onNewGameDecline: () => onInput({ action: "newGameDecline" }),
    });
  }
}
