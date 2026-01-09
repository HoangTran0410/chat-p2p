import React, { useEffect, useRef } from "react";
import type { GameSession } from "../types";
import type { ChessData } from "./Chess";
import type { Chess, Square } from "chess.js";
import { Chessground as ChessgroundApi } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import { useGameStore } from "../../stores/gameStore";
import { RotateCcw, Plus } from "lucide-react";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

interface ChessUIProps {
  state: GameSession<ChessData>;
  myId: string;
  isHost: boolean;
  isMyTurn: boolean;
  chess: Chess;
  onMove: (from: string, to: string, promotion?: string) => void;
  onUndoRequest: () => void;
  onUndoConfirm: () => void;
  onUndoDecline: () => void;
  onNewGameRequest: () => void;
  onNewGameConfirm: () => void;
  onNewGameDecline: () => void;
}

export function ChessUI({
  state,
  myId,
  isHost,
  isMyTurn,
  chess,
  onMove,
  onUndoRequest,
  onUndoConfirm,
  onUndoDecline,
  onNewGameRequest,
  onNewGameConfirm,
  onNewGameDecline,
}: ChessUIProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const chessgroundRef = useRef<Api | null>(null);
  const { leaveGame } = useGameStore();

  const myColor = isHost ? "white" : "black";
  const inCheck = chess.inCheck();
  const turn = chess.turn();

  // Initialize Chessground
  useEffect(() => {
    if (!boardRef.current || chessgroundRef.current) return;

    chessgroundRef.current = ChessgroundApi(boardRef.current, {
      fen: state.data.fen,
      orientation: myColor,
      turnColor: turn === "w" ? "white" : "black",
      movable: {
        free: false,
        color: isMyTurn ? myColor : undefined,
        dests: getValidMoves(),
      },
      events: {
        move: (orig, dest) => {
          handleMove(orig as string, dest as string);
        },
      },
      draggable: {
        enabled: true,
        showGhost: true,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      animation: {
        enabled: true,
        duration: 200,
      },
    });

    return () => {
      chessgroundRef.current?.destroy();
      chessgroundRef.current = null;
    };
  }, []);

  // Update board when state changes
  useEffect(() => {
    if (!chessgroundRef.current) return;

    chessgroundRef.current.set({
      fen: state.data.fen,
      turnColor: turn === "w" ? "white" : "black",
      movable: {
        free: false,
        color: isMyTurn && state.status === "playing" ? myColor : undefined,
        dests: isMyTurn ? getValidMoves() : new Map(),
      },
      check: inCheck ? (turn === "w" ? "white" : "black") : undefined,
    });
  }, [state.data.fen, isMyTurn, state.status]);

  const getValidMoves = (): Map<Key, Key[]> => {
    const dests = new Map<Key, Key[]>();

    // Debug log
    console.log("getValidMoves check:", {
      isMyTurn,
      status: state.status,
      turn: chess.turn(),
      myColor,
      isHost,
    });

    if (!isMyTurn || state.status !== "playing") return dests;

    // Manually define all 64 squares (a1-h8)
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

    let moveCount = 0;
    files.forEach((file) => {
      ranks.forEach((rank) => {
        const square = `${file}${rank}` as Square;
        const moves = chess.moves({ square, verbose: true });
        if (moves.length > 0) {
          moveCount += moves.length;
          dests.set(
            square,
            moves.map((m) => m.to)
          );
        }
      });
    });

    console.log("getValidMoves result:", {
      count: moveCount,
      squaresWithMoves: dests.size,
    });
    return dests;
  };

  const handleMove = (from: string, to: string) => {
    // Check if pawn promotion
    const piece = chess.get(from as Square);
    const isPromotion =
      piece?.type === "p" &&
      ((piece.color === "w" && to[1] === "8") ||
        (piece.color === "b" && to[1] === "1"));

    if (isPromotion) {
      // For simplicity, always promote to queen
      onMove(from, to, "q");
    } else {
      onMove(from, to);
    }
  };

  const lastMove = state.data.moveHistory[state.data.moveHistory.length - 1];

  // Map piece letter to display symbol
  // SVG Paths for Chess Pieces
  const PIECE_SVGS: Record<string, React.ReactNode> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-2xl mx-auto">
      {/* Status Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {state.status === "finished" ? (
            <div className="text-lg font-bold">
              {state.winner ? (
                <span
                  className={
                    state.winner === myId ? "text-green-400" : "text-red-400"
                  }
                >
                  {state.winner === myId ? "You Won!" : "Opponent Won!"}
                </span>
              ) : (
                <span className="text-yellow-400">Draw!</span>
              )}
            </div>
          ) : (
            <>
              <div
                className={`text-lg font-bold ${
                  isMyTurn ? "text-primary-400" : "text-slate-400"
                }`}
              >
                {isMyTurn ? "Your Turn" : "Opponent's Turn"}
              </div>
              {inCheck && turn === myColor[0] && (
                <div className="text-sm text-red-400 font-semibold">
                  You are in check!
                </div>
              )}
            </>
          )}
          <div className="text-xs text-slate-500">
            Playing as {isHost ? "White" : "Black"}
          </div>
        </div>

        {/* Controls */}
        {state.status === "finished" && (
          <div className="flex gap-2">
            <button
              onClick={() => useGameStore.getState().restartGame()}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              onClick={leaveGame}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Undo Controls */}
        {/* {state.status === "playing" && (
          <div className="flex gap-2">
            {state.data.pendingUndoRequest ? (
              state.data.pendingUndoRequest === myId ? (
                <div className="px-3 py-2 bg-yellow-500/20 text-yellow-200 rounded-lg text-sm font-medium flex items-center gap-2">
                  <span>Undo requested...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-300 px-2">
                    Opp request undo
                  </span>
                  <button
                    onClick={onUndoConfirm}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={onUndoDecline}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors"
                  >
                    Decline
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={onUndoRequest}
                disabled={state.data.moveHistory.length === 0}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-300 font-medium transition-colors flex items-center gap-2 text-sm"
              >
                <div className="scale-x-[-1]">
                  <RotateCcw className="w-4 h-4" />
                </div>
                Undo
              </button>
            )}
          </div>
        )} */}
      </div>

      {/* New Game Controls */}
      {state.status === "playing" && (
        <div className="flex justify-center w-full gap-1">
          {state.data.pendingUndoRequest ? (
            state.data.pendingUndoRequest === myId ? (
              <div className="px-3 py-2 bg-yellow-500/20 text-yellow-200 rounded-lg text-sm font-medium flex items-center gap-2">
                <span>Undo requested...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <span className="text-sm text-slate-300 px-2">
                  Opp request undo
                </span>
                <button
                  onClick={onUndoConfirm}
                  className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={onUndoDecline}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors"
                >
                  Decline
                </button>
              </div>
            )
          ) : (
            <button
              onClick={onUndoRequest}
              disabled={state.data.moveHistory.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-300 font-medium transition-colors flex items-center gap-2 text-sm"
            >
              <div className="scale-x-[-1]">
                <RotateCcw className="w-4 h-4" />
              </div>
              Undo
            </button>
          )}

          {state.data.pendingNewGameRequest ? (
            state.data.pendingNewGameRequest === myId ? (
              <div className="px-3 py-2 bg-blue-500/20 text-blue-200 rounded-lg text-sm font-medium flex items-center gap-2">
                <span>New Game requested...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 w-full justify-between">
                <span className="text-sm text-slate-300 px-2">
                  Opp request New Game
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onNewGameConfirm}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={onNewGameDecline}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )
          ) : (
            !state.data.pendingUndoRequest && (
              <button
                onClick={onNewGameRequest}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors flex items-center gap-2 text-sm justify-center"
              >
                <Plus className="w-4 h-4" />
                New Game
              </button>
            )
          )}
        </div>
      )}

      {/* Chessboard */}
      <div className="w-full max-w-xl">
        <div
          ref={boardRef}
          className="w-full aspect-square"
          style={{ maxHeight: "min(80vh, 600px)" }}
        />
      </div>

      {/* Move History */}
      {state.data.moveHistory.length > 0 && (
        <div className="w-full bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-2">Last move:</div>
          <div className="text-lg font-mono text-slate-200">{lastMove}</div>
        </div>
      )}

      {/* Captured Pieces */}
      <div className="w-full flex justify-between gap-4 text-sm">
        <div className="bg-slate-800 rounded-lg p-2 flex-1">
          <div className="text-xs text-slate-400 mb-1">White captured:</div>
          <div className="flex flex-wrap gap-1">
            {state.data.capturedPieces.white.length > 0 ? (
              state.data.capturedPieces.white.map((p, i) => (
                <div
                  key={i}
                  className="cg-wrap"
                  style={{ width: 25, height: 25 }}
                >
                  {React.createElement("piece", {
                    className: `piece ${
                      PIECE_SVGS[p.toLowerCase()]
                    } black` /* White captured black pieces */,
                    style: { width: 25, height: 25 },
                  })}
                </div>
              ))
            ) : (
              <span className="text-slate-600">-</span>
            )}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 flex-1">
          <div className="text-xs text-slate-400 mb-1">Black captured:</div>
          <div className="flex flex-wrap gap-1">
            {state.data.capturedPieces.black.length > 0 ? (
              state.data.capturedPieces.black.map((p, i) => (
                <div
                  key={i}
                  className="cg-wrap"
                  style={{ width: 25, height: 25 }}
                >
                  {React.createElement("piece", {
                    className: `piece ${
                      PIECE_SVGS[p.toLowerCase()]
                    } white` /* Black captured white pieces */,
                    style: { width: 25, height: 25 },
                  })}
                </div>
              ))
            ) : (
              <span className="text-slate-600">-</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
