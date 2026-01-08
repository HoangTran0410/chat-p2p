import { BaseGame } from "../BaseGame";
import { GameSession, GameMoveAction } from "../types";
import { CaroUI } from "./CaroUI";
import React from "react";

// Game state - using sparse storage for efficiency
export interface CaroData {
  board: Record<string, "X" | "O">; // key: "row,col" -> symbol
  winningLine: number[][] | null;
}

// Move payload
export interface CaroMove {
  row: number;
  col: number;
}

export class CaroGame extends BaseGame<CaroData, CaroMove> {
  readonly gameId = "caro";
  readonly gameName = "Caro (Gomoku)";
  readonly gameIcon = "❌";
  readonly gameDescription = "5-in-a-row on large board";

  readonly BOARD_SIZE = 50;
  readonly WIN_LENGTH = 5;

  createInitialState(hostId: string, guestId: string): CaroData {
    return {
      board: {}, // Empty - sparse storage
      winningLine: null,
    };
  }

  isValidMove(
    state: GameSession<CaroData>,
    action: GameMoveAction<CaroMove>
  ): boolean {
    const { row, col } = action.payload;
    const key = `${row},${col}`;

    return (
      state.currentTurn === action.playerId &&
      !state.data.board[key] &&
      row >= 0 &&
      row < this.BOARD_SIZE &&
      col >= 0 &&
      col < this.BOARD_SIZE
    );
  }

  applyMove(
    state: GameSession<CaroData>,
    action: GameMoveAction<CaroMove>
  ): GameSession<CaroData> {
    const { row, col } = action.payload;
    const key = `${row},${col}`;
    const symbol = state.currentTurn === state.hostId ? "X" : "O";

    return {
      ...state,
      data: {
        ...state.data,
        board: {
          ...state.data.board,
          [key]: symbol,
        },
      },
    };
  }

  checkGameEnd(state: GameSession<CaroData>): {
    isEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  } {
    const { board } = state.data;

    // Check all placed pieces for winning line
    for (const key in board) {
      const [row, col] = key.split(",").map(Number);
      const winLine = this.checkWinFrom(board, row, col);
      if (winLine) {
        return {
          isEnded: true,
          winner: board[key] === "X" ? state.hostId : state.guestId,
          isDraw: false,
        };
      }
    }

    return { isEnded: false, winner: null, isDraw: false };
  }

  private checkWinFrom(
    board: Record<string, "X" | "O">,
    row: number,
    col: number
  ): number[][] | null {
    const symbol = board[`${row},${col}`];
    if (!symbol) return null;

    const directions = [
      [0, 1], // horizontal →
      [1, 0], // vertical ↓
      [1, 1], // diagonal ↘
      [1, -1], // diagonal ↙
    ];

    for (const [dr, dc] of directions) {
      const line: number[][] = [[row, col]];

      // Check positive direction
      for (let i = 1; i < this.WIN_LENGTH; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (board[`${r},${c}`] === symbol) {
          line.push([r, c]);
        } else break;
      }

      // Check negative direction
      for (let i = 1; i < this.WIN_LENGTH; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (board[`${r},${c}`] === symbol) {
          line.unshift([r, c]);
        } else break;
      }

      if (line.length >= this.WIN_LENGTH) {
        return line.slice(0, this.WIN_LENGTH);
      }
    }

    return null;
  }

  renderGame(
    state: GameSession<CaroData>,
    myId: string,
    onMove: (payload: CaroMove) => void,
    isMyTurn: boolean
  ): React.ReactNode {
    return React.createElement(CaroUI, {
      state,
      myId,
      onMove,
      isMyTurn,
    });
  }
}
