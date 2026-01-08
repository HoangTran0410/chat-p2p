import { BaseGame } from "../BaseGame";
import { GameSession, GameMoveAction } from "../types";
import { TicTacToeUI } from "./TicTacToeUI";
import React from "react";

export interface TicTacToeData {
  board: (string | null)[]; // 9 cells
  winningLine: number[] | null;
}

export type TicTacToeMove = number; // Index 0-8

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // Rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // Columns
  [0, 4, 8],
  [2, 4, 6], // Diagonals
];

export class TicTacToeGame extends BaseGame<TicTacToeData, TicTacToeMove> {
  readonly gameId = "tictactoe";
  readonly gameName = "Tic-Tac-Toe";
  readonly gameIcon = "⭕";
  readonly gameDescription = "Classic 3x3 strategy game";

  createInitialState(hostId: string, guestId: string): TicTacToeData {
    return {
      board: Array(9).fill(null),
      winningLine: null,
    };
  }

  isValidMove(
    state: GameSession<TicTacToeData>,
    action: GameMoveAction<TicTacToeMove>
  ): boolean {
    const { board } = state.data;
    const index = action.payload;

    // Check bounds
    if (index < 0 || index > 8) return false;

    // Check if cell is empty
    if (board[index] !== null) return false;

    // Check if game is already won
    if (state.winner) return false;

    // Check turn (already handled by store, but good to double check)
    if (!this.isPlayerTurn(state, action.playerId)) return false;

    return true;
  }

  applyMove(
    state: GameSession<TicTacToeData>,
    action: GameMoveAction<TicTacToeMove>
  ): GameSession<TicTacToeData> {
    const { board } = state.data;
    const index = action.payload;
    const playerSymbol = action.playerId === state.hostId ? "X" : "O";

    // Create new board
    const newBoard = [...board];
    newBoard[index] = playerSymbol;

    return {
      ...state,
      data: {
        ...state.data,
        board: newBoard,
      },
    };
  }

  checkGameEnd(state: GameSession<TicTacToeData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  } {
    const { board } = state.data;

    // Check winner
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        // Find winner ID based on symbol
        const winnerId = board[a] === "X" ? state.hostId : state.guestId;

        // Store winning line in data (we need to be careful with immutability,
        // but typically checkGameEnd is called after applyMove which returns new state,
        // so we might need to update state.data.winningLine separately or just return it here if possible.
        // BaseGame structure wraps this, so we'll just determine result here.
        // Ideally we'd update winningLine in applyMove, but we can't easily there.
        // Let's rely on UI to recalculate winning line or we can update it in the returned state if we changed the hook signature.
        // For now, let's keep it simple.

        return { isEnded: true, winner: winnerId, isDraw: false };
      }
    }

    // Check draw
    if (board.every((cell) => cell !== null)) {
      return { isEnded: true, winner: null, isDraw: true };
    }

    return { isEnded: false, winner: null, isDraw: false };
  }

  renderGame(
    state: GameSession<TicTacToeData>,
    myId: string,
    onMove: (payload: TicTacToeMove) => void,
    isMyTurn: boolean
  ): React.ReactNode {
    return React.createElement(TicTacToeUI, {
      state,
      myId,
      onMove,
      isMyTurn,
    });
  }
}
