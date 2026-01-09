import { BaseGame } from "../BaseGame";
import { GameSession } from "../types";
import { CaroUI } from "./CaroUI";
import React from "react";

// Game state - using sparse storage for efficiency
export interface CaroData {
  board: Record<string, "X" | "O">; // key: "row,col" -> symbol
  currentTurn: string; // Player ID whose turn it is
  winningLine: number[][] | null;
  pendingUndoRequest: string | null; // Player ID who is requesting undo
}

// Input payload
export interface CaroInput {
  action: "move" | "switchTurn" | "undoRequest" | "undoConfirm" | "undoDecline";
  row?: number;
  col?: number;
}

// Alias for UI compatibility
export type CaroMove = {
  row: number;
  col: number;
};

export class CaroGame extends BaseGame<CaroData, CaroInput> {
  readonly gameId = "caro";
  readonly gameName = "Caro (Gomoku)";
  readonly gameIcon = "❌";
  readonly gameDescription = "5-in-a-row on large board";

  readonly BOARD_SIZE = 50;
  readonly WIN_LENGTH = 5;

  createInitialState(hostId: string, clientId: string): CaroData {
    return {
      board: {}, // Empty - sparse storage
      currentTurn: hostId, // Host goes first
      winningLine: null,
      pendingUndoRequest: null,
    };
  }

  handleInput(
    state: GameSession<CaroData>,
    input: CaroInput,
    playerId: string,
    isHost: boolean
  ): GameSession<CaroData> {
    // Handle undo request
    if (input.action === "undoRequest") {
      const { board, currentTurn, pendingUndoRequest } = state.data;

      // Can't request undo if board is empty
      if (Object.keys(board).length === 0) return state;

      // Can't request if there's already a pending request
      if (pendingUndoRequest) return state;

      // Can't request undo during your own turn (only request when opponent just moved)
      if (playerId === currentTurn) return state;

      return {
        ...state,
        data: {
          ...state.data,
          pendingUndoRequest: playerId,
        },
        updatedAt: Date.now(),
      };
    }

    // Handle undo confirm
    if (input.action === "undoConfirm") {
      const { board, currentTurn, pendingUndoRequest } = state.data;

      // Only the player who was asked can confirm
      if (!pendingUndoRequest || playerId !== currentTurn) return state;

      // Find last move
      const keys = Object.keys(board);
      if (keys.length === 0) return state;

      const lastKey = keys[keys.length - 1];

      // Remove last move
      const newBoard = { ...board };
      delete newBoard[lastKey];

      // Give turn back to the player who made that move
      const lastMovePlayer =
        currentTurn === state.hostId ? state.clientId : state.hostId;

      return {
        ...state,
        data: {
          ...state.data,
          board: newBoard,
          currentTurn: lastMovePlayer,
          pendingUndoRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    // Handle undo decline
    if (input.action === "undoDecline") {
      const { pendingUndoRequest } = state.data;

      // Only the player who was asked can decline
      if (!pendingUndoRequest) return state;

      return {
        ...state,
        data: {
          ...state.data,
          pendingUndoRequest: null,
        },
        updatedAt: Date.now(),
      };
    }

    // Handle switchTurn action
    if (input.action === "switchTurn") {
      const { board, currentTurn } = state.data;

      // Only allow switching turn when board is empty
      if (Object.keys(board).length > 0) return state;

      // Only current turn player can switch
      if (playerId !== currentTurn) return state;

      // Switch to the other player
      const nextTurn =
        playerId === state.hostId ? state.clientId : state.hostId;

      return {
        ...state,
        data: {
          ...state.data,
          currentTurn: nextTurn,
        },
        updatedAt: Date.now(),
      };
    }

    // Handle move action
    const { row, col } = input;
    if (row === undefined || col === undefined) return state;

    const { board, currentTurn } = state.data;
    const key = `${row},${col}`;

    // Validate move (both host and client validate)
    if (playerId !== currentTurn) return state;
    if (board[key]) return state; // Cell already occupied
    if (row < 0 || row >= this.BOARD_SIZE) return state;
    if (col < 0 || col >= this.BOARD_SIZE) return state;

    // Apply move
    const symbol = playerId === state.hostId ? "X" : "O";
    const nextTurn = playerId === state.hostId ? state.clientId : state.hostId;

    return {
      ...state,
      data: {
        ...state.data,
        board: {
          ...board,
          [key]: symbol,
        },
        currentTurn: nextTurn,
      },
      updatedAt: Date.now(),
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
          winner: board[key] === "X" ? state.hostId : state.clientId,
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

  render(
    state: GameSession<CaroData>,
    myId: string,
    isHost: boolean,
    onInput: (input: CaroInput) => void
  ): React.ReactNode {
    const isMyTurn = state.data.currentTurn === myId;

    return React.createElement(CaroUI, {
      state,
      myId,
      onMove: (move: CaroMove) => onInput({ action: "move", ...move }),
      onSwitchTurn: () => onInput({ action: "switchTurn" }),
      onUndoRequest: () => onInput({ action: "undoRequest" }),
      onUndoConfirm: () => onInput({ action: "undoConfirm" }),
      onUndoDecline: () => onInput({ action: "undoDecline" }),
      isMyTurn,
    });
  }
}
