import React, { useState, useRef, useEffect } from "react";
import { GameSession } from "../types";
import { CaroData, CaroMove } from "./Caro";
import { X, Circle, Target, Undo, RotateCcw } from "lucide-react";
import { useGameStore } from "../../stores/gameStore";

interface CaroUIProps {
  state: GameSession<CaroData>;
  myId: string;
  onMove: (move: CaroMove) => void;
  isMyTurn: boolean;
}

const BOARD_SIZE = 50;
const CELL_SIZE = 40;

export function CaroUI({ state, myId, onMove, isMyTurn }: CaroUIProps) {
  const { board, winningLine } = state.data;
  const isHost = myId === state.hostId;
  const mySymbol = isHost ? "X" : "O";
  const { leaveGame } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport state
  const [viewport, setViewport] = useState({
    x: 20,
    y: 20,
  });

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({
    x: 0,
    y: 0,
    viewportX: 0,
    viewportY: 0,
  });
  const [hoverCell, setHoverCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Canvas size - responsive
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });

  // Get last move
  const getLastMove = (): { row: number; col: number } | null => {
    const moves = Object.keys(board);
    if (moves.length === 0) return null;
    const lastKey = moves[moves.length - 1];
    const [row, col] = lastKey.split(",").map(Number);
    return { row, col };
  };

  // Update canvas size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        setCanvasSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Calculate view area
    const cellSize = CELL_SIZE;
    const visibleCols = Math.ceil(canvasSize.width / cellSize);
    const visibleRows = Math.ceil(canvasSize.height / cellSize);

    // Calculate offset (smooth pan)
    const offsetX = -(viewport.x * cellSize) % cellSize;
    const offsetY = -(viewport.y * cellSize) % cellSize;

    const startCol = Math.floor(viewport.x);
    const startRow = Math.floor(viewport.y);

    // Draw grid
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;

    for (let i = 0; i <= visibleCols + 1; i++) {
      const x = offsetX + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.height);
      ctx.stroke();
    }

    for (let i = 0; i <= visibleRows + 1; i++) {
      const y = offsetY + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize.width, y);
      ctx.stroke();
    }

    // Draw hover
    if (hoverCell && isMyTurn && state.status === "playing") {
      const hoverCol = hoverCell.col - startCol;
      const hoverRow = hoverCell.row - startRow;

      if (
        hoverCol >= 0 &&
        hoverCol < visibleCols &&
        hoverRow >= 0 &&
        hoverRow < visibleRows
      ) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
        ctx.fillRect(
          offsetX + hoverCol * cellSize,
          offsetY + hoverRow * cellSize,
          cellSize,
          cellSize
        );
      }
    }

    // Draw pieces
    for (let i = 0; i < visibleCols + 1; i++) {
      for (let j = 0; j < visibleRows + 1; j++) {
        const col = startCol + i;
        const row = startRow + j;

        if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE)
          continue;

        const key = `${row},${col}`;
        const symbol = board[key];
        if (!symbol) continue;

        const x = offsetX + i * cellSize + cellSize / 2;
        const y = offsetY + j * cellSize + cellSize / 2;

        const isWinning = winningLine?.some(([r, c]) => r === row && c === col);
        const lastMove = getLastMove();
        const isLast = lastMove && lastMove.row === row && lastMove.col === col;

        if (symbol === "X") {
          ctx.strokeStyle = isWinning ? "#4ade80" : "#3b82f6";
          ctx.lineWidth = isLast ? 4 : 3;
          const size = cellSize * 0.3;

          ctx.beginPath();
          ctx.moveTo(x - size, y - size);
          ctx.lineTo(x + size, y + size);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x + size, y - size);
          ctx.lineTo(x - size, y + size);
          ctx.stroke();
        } else {
          ctx.strokeStyle = isWinning ? "#4ade80" : "#ef4444";
          ctx.lineWidth = isLast ? 4 : 3;
          const radius = cellSize * 0.25;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Draw coordinates in corner
    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    ctx.fillText(`(${startCol}, ${startRow})`, 5, 15);
  }, [
    viewport,
    board,
    winningLine,
    hoverCell,
    isMyTurn,
    state.status,
    canvasSize,
  ]);

  // Convert canvas coordinates to board position
  const canvasToBoard = (
    clientX: number,
    clientY: number
  ): { row: number; col: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cellSize = CELL_SIZE;
    const col = Math.floor(viewport.x + x / cellSize);
    const row = Math.floor(viewport.y + y / cellSize);

    if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE)
      return null;

    return { row, col };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update hover
    const pos = canvasToBoard(e.clientX, e.clientY);
    setHoverCell(pos);

    // Pan
    if (isPanning) {
      const dx = (panStart.x - e.clientX) / CELL_SIZE;
      const dy = (panStart.y - e.clientY) / CELL_SIZE;

      setViewport({
        x: Math.max(0, Math.min(BOARD_SIZE - 1, panStart.viewportX + dx)),
        y: Math.max(0, Math.min(BOARD_SIZE - 1, panStart.viewportY + dy)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setHoverCell(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't place if was panning
    if (
      Math.abs(e.clientX - panStart.x) > 5 ||
      Math.abs(e.clientY - panStart.y) > 5
    ) {
      return;
    }

    if (!isMyTurn || state.status !== "playing") return;

    const pos = canvasToBoard(e.clientX, e.clientY);
    if (!pos) return;

    const key = `${pos.row},${pos.col}`;
    if (board[key]) return;

    onMove(pos);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsPanning(true);
    setPanStart({
      x: touch.clientX,
      y: touch.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];

    // Update hover
    const pos = canvasToBoard(touch.clientX, touch.clientY);
    setHoverCell(pos);

    // Pan
    if (isPanning) {
      const dx = (panStart.x - touch.clientX) / CELL_SIZE;
      const dy = (panStart.y - touch.clientY) / CELL_SIZE;

      setViewport({
        x: Math.max(0, Math.min(BOARD_SIZE - 1, panStart.viewportX + dx)),
        y: Math.max(0, Math.min(BOARD_SIZE - 1, panStart.viewportY + dy)),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];

    // Don't place if was panning
    if (
      Math.abs(touch.clientX - panStart.x) > 5 ||
      Math.abs(touch.clientY - panStart.y) > 5
    ) {
      setIsPanning(false);
      setHoverCell(null);
      return;
    }

    setIsPanning(false);
    setHoverCell(null);

    if (!isMyTurn || state.status !== "playing") return;

    const pos = canvasToBoard(touch.clientX, touch.clientY);
    if (!pos) return;

    const key = `${pos.row},${pos.col}`;
    if (board[key]) return;

    onMove(pos);
  };

  const focusLastMove = () => {
    const lastMove = getLastMove();
    if (!lastMove) return;

    const targetX = Math.max(0, lastMove.col - 3);
    const targetY = Math.max(0, lastMove.row - 3);

    // Smooth animation
    const startX = viewport.x;
    const startY = viewport.y;
    const startTime = performance.now();
    const duration = 300; // ms

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      setViewport({
        x: startX + (targetX - startX) * eased,
        y: startY + (targetY - startY) * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div className="flex flex-col gap-3 p-2 md:p-4 w-full h-full">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">
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
              <span
                className={isMyTurn ? "text-primary-400" : "text-slate-400"}
              >
                {isMyTurn ? "Your Turn" : "Opponent's Turn"}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <X className="w-3 h-3 text-blue-400" />{" "}
              {mySymbol === "X" ? "You" : "Opp"}
            </span>
            <span className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-red-400" />{" "}
              {mySymbol === "O" ? "You" : "Opp"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 text-xs">
          {state.status === "finished" ? (
            <button
              onClick={() => useGameStore.getState().restartGame()}
              className="px-2 py-1 bg-primary-600 hover:bg-primary-500 rounded text-white flex items-center gap-1"
              title="New game"
            >
              <RotateCcw className="w-3 h-3" />
              <span>New Game</span>
            </button>
          ) : (
            <button
              onClick={focusLastMove}
              disabled={Object.keys(board).length === 0}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Focus to last move"
            >
              <Target className="w-3 h-3" />
              <span>Last</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full h-full border-2 border-slate-700 rounded-lg bg-slate-900 cursor-move touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Helper text */}
      <div className="text-xs text-slate-500 text-center">
        Drag to pan • Click to place
      </div>
    </div>
  );
}
