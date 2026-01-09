import { BaseGame } from "../BaseGame";
import { GameSession } from "../types";
import { TicTacToeUI } from "./TicTacToeUI";
import React from "react";

export interface TicTacToeData {
  board: (string | null)[]; // 9 cells
  currentTurn: string; // Player ID whose turn it is
  winningLine: number[] | null;
}

export interface TicTacToeInput {
  action: "move" | "switchTurn";
  cellIndex?: number; // Index 0-8 (only for move action)
}

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

export class TicTacToeGame extends BaseGame<TicTacToeData, TicTacToeInput> {
  readonly gameId = "tictactoe";
  readonly gameName = "Tic-Tac-Toe";
  readonly gameIcon = "⭕";
  readonly gameDescription = "Classic 3x3 strategy game";

  createInitialState(hostId: string, clientId: string): TicTacToeData {
    return {
      board: Array(9).fill(null),
      currentTurn: hostId, // Host goes first
      winningLine: null,
    };
  }

  handleInput(
    state: GameSession<TicTacToeData>,
    input: TicTacToeInput,
    playerId: string,
    isHost: boolean
  ): GameSession<TicTacToeData> {
    // Handle switchTurn action
    if (input.action === "switchTurn") {
      const { board, currentTurn } = state.data;

      // Only allow switching turn when board is empty
      if (board.some((cell) => cell !== null)) return state;

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
    const { cellIndex } = input;
    if (cellIndex === undefined) return state;

    const { board, currentTurn } = state.data;

    // Validate move (both host and client validate for client-side prediction)

    // Check bounds
    if (cellIndex < 0 || cellIndex > 8) return state;

    // Check if cell is empty
    if (board[cellIndex] !== null) return state;

    // Check if game is already won
    if (state.winner) return state;

    // Check turn
    if (playerId !== currentTurn) return state;

    // Apply move (both host and client apply optimistically)
    const playerSymbol = playerId === state.hostId ? "X" : "O";
    const newBoard = [...board];
    newBoard[cellIndex] = playerSymbol;

    // Switch turn
    const nextTurn = playerId === state.hostId ? state.clientId : state.hostId;

    return {
      ...state,
      data: {
        ...state.data,
        board: newBoard,
        currentTurn: nextTurn,
      },
      updatedAt: Date.now(),
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
        const winnerId = board[a] === "X" ? state.hostId : state.clientId;
        return { isEnded: true, winner: winnerId, isDraw: false };
      }
    }

    // Check draw
    if (board.every((cell) => cell !== null)) {
      return { isEnded: true, winner: null, isDraw: true };
    }

    return { isEnded: false, winner: null, isDraw: false };
  }

  render(
    state: GameSession<TicTacToeData>,
    myId: string,
    isHost: boolean,
    onInput: (input: TicTacToeInput) => void
  ): React.ReactNode {
    const isMyTurn = state.data.currentTurn === myId;

    return React.createElement(TicTacToeUI, {
      state,
      myId,
      onMove: (cellIndex: number) => onInput({ action: "move", cellIndex }),
      onSwitchTurn: () => onInput({ action: "switchTurn" }),
      isMyTurn,
    });
  }
}
