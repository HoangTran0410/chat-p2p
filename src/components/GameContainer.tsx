import React from "react";
import { X, Minimize2, Maximize2, AlertCircle } from "lucide-react";
import { useGameStore } from "../stores/gameStore";
import { useP2PStore } from "../stores/p2pStore";
import { gameRegistry } from "../games";

interface GameContainerProps {
  isMinimized?: boolean; // If we want to support minimizing the game view
  onToggleMinimize?: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({
  isMinimized = false,
  onToggleMinimize,
}) => {
  const { activeGame, makeMove, leaveGame } = useGameStore();
  const { myId } = useP2PStore();

  if (!activeGame || !myId) return null;

  const gameImpl = gameRegistry.createInstance(activeGame.gameType);
  if (!gameImpl) return null; // Should not happen

  return (
    <div className="bg-slate-900 border-b border-slate-800 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xl">{gameImpl.gameIcon}</span>
          <span className="font-medium text-slate-200">
            {gameImpl.gameName}
          </span>
          {activeGame.status === "finished" && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Finished
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={() => {
              if (
                activeGame.status === "playing" &&
                !confirm("Are you sure you want to leave the game?")
              ) {
                return;
              }
              leaveGame();
            }}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            title="Leave Game"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Game Content */}
      {!isMinimized && (
        <div className="p-2 bg-slate-950/30 min-h-[300px] flex items-center justify-center relative">
          {activeGame.status === "waiting" && (
            <div className="absolute inset-0 bg-slate-950/80 z-10 flex items-center justify-center flex-col gap-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 animate-pulse ring-1 ring-slate-700">
                <span className="text-3xl animate-bounce">⏳</span>
              </div>
              <div className="text-center">
                <p className="text-slate-200 font-medium text-lg">
                  Waiting for opponent...
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Request sent to peer
                </p>
              </div>
              <button
                onClick={leaveGame}
                className="mt-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
              >
                Cancel Request
              </button>
            </div>
          )}
          {activeGame.status === "cancelled" && (
            <div className="absolute inset-0 bg-slate-950/80 z-10 flex items-center justify-center flex-col gap-2">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
              <p className="text-slate-300">Game Cancelled</p>
              <button
                onClick={leaveGame}
                className="text-sm text-primary-400 hover:underline"
              >
                Close
              </button>
            </div>
          )}
          {gameImpl.render(
            activeGame,
            myId,
            myId === activeGame.hostId,
            (payload) => makeMove(payload)
          )}
        </div>
      )}
    </div>
  );
};
