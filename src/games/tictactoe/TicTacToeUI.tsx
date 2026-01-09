import React from "react";
import { GameSession } from "../types";
import { TicTacToeData } from "./TicTacToe";
import { X, Circle, RefreshCcw } from "lucide-react";
import { useGameStore } from "../../stores/gameStore";

interface TicTacToeUIProps {
  state: GameSession<TicTacToeData>;
  myId: string;
  onMove: (index: number) => void;
  onSwitchTurn: () => void;
  isMyTurn: boolean;
}

export function TicTacToeUI({
  state,
  myId,
  onMove,
  onSwitchTurn,
  isMyTurn,
}: TicTacToeUIProps) {
  const { board } = state.data;
  const isHost = myId === state.hostId;
  const mySymbol = isHost ? "X" : "O";
  const { leaveGame } = useGameStore();

  const getWinnerLine = () => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return line;
      }
    }
    return null;
  };

  const winningLine = getWinnerLine();

  const getLastMove = (): number | null => {
    // Find the last non-null cell
    for (let i = board.length - 1; i >= 0; i--) {
      if (board[i] !== null) return i;
    }
    return null;
  };

  const lastMoveIndex = getLastMove();

  const handleCellClick = (index: number) => {
    if (!isMyTurn || board[index] || state.status !== "playing") return;
    onMove(index);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-sm mx-auto">
      {/* Status Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-xl font-bold flex items-center gap-2">
          {state.status === "finished" ? (
            state.winner ? (
              <span
                className={
                  state.winner === myId ? "text-green-400" : "text-red-400"
                }
              >
                {state.winner === myId ? "You Won!" : "Opponent Won!"}
              </span>
            ) : (
              <span className="text-yellow-400">Draw!</span>
            )
          ) : (
            <span className={isMyTurn ? "text-primary-400" : "text-slate-400"}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <X className="w-4 h-4 text-blue-400" /> You: {mySymbol}
          </span>
          <span className="flex items-center gap-1">
            <Circle className="w-4 h-4 text-red-400" /> Opponent:{" "}
            {mySymbol === "X" ? "O" : "X"}
          </span>
        </div>

        {/* Switch Turn button - only show when board is empty */}
        {state.status === "playing" &&
          board.every((cell) => cell === null) &&
          isMyTurn && (
            <button
              onClick={onSwitchTurn}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm font-medium transition-colors flex items-center gap-2"
              title="Give first move to opponent"
            >
              <RefreshCcw className="w-4 h-4" />
              Give First Move
            </button>
          )}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-3 bg-slate-800 p-3 rounded-xl relative">
        {board.map((cell, index) => {
          const isWinningCell = winningLine?.includes(index);
          const isLastMove = lastMoveIndex === index;
          const canInteract = isMyTurn && !cell && state.status === "playing";

          return (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={!canInteract}
              className={`
                w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex items-center justify-center text-4xl transition-all
                ${
                  cell
                    ? "bg-slate-700 shadow-inner"
                    : "bg-slate-750 hover:bg-slate-700"
                }
                ${isWinningCell ? "bg-green-500/20 ring-2 ring-green-500" : ""}
                ${
                  isLastMove && !isWinningCell
                    ? "bg-amber-500/20 ring-2 ring-amber-500/50"
                    : ""
                }
                ${
                  canInteract
                    ? "cursor-pointer hover:ring-2 hover:ring-primary-500/50"
                    : "cursor-default"
                }
              `}
            >
              {cell === "X" && (
                <X
                  className={`w-12 h-12 ${
                    isWinningCell ? "text-green-400" : "text-blue-400"
                  }`}
                  strokeWidth={2.5}
                />
              )}
              {cell === "O" && (
                <Circle
                  className={`w-10 h-10 ${
                    isWinningCell ? "text-green-400" : "text-red-400"
                  }`}
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}

        {/* Diagonal Strike line could be added here for extra polish */}
      </div>

      {/* Game Over Actions */}
      {state.status === "finished" && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => useGameStore.getState().restartGame()}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 rounded-lg text-white font-medium transition-colors shadow-lg shadow-primary-900/20"
          >
            Play Again
          </button>
          <button
            onClick={leaveGame}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors"
          >
            Close Game
          </button>
        </div>
      )}
    </div>
  );
}
