import { BaseGame } from "../BaseGame";
import { GameSession } from "../types";
import { CanvasUI } from "./CanvasUI";
import React from "react";

// Game state
export interface CanvasData {
  strokes: DrawStroke[];
}

// Drawing stroke
export interface DrawStroke {
  id: string;
  playerId: string;
  points: Point[];
  color: string;
  width: number;
}

export interface Point {
  x: number;
  y: number;
}

// Input types
export type CanvasInput =
  | { type: "draw"; stroke: DrawStroke }
  | { type: "clear" };

export class CollaborativeCanvas extends BaseGame<CanvasData, CanvasInput> {
  readonly gameId = "canvas";
  readonly gameName = "Draw Together";
  readonly gameIcon = "🎨";
  readonly gameDescription = "Collaborative drawing canvas";

  createInitialState(hostId: string, clientId: string): CanvasData {
    return {
      strokes: [],
    };
  }

  handleInput(
    state: GameSession<CanvasData>,
    input: CanvasInput,
    playerId: string,
    isHost: boolean
  ): GameSession<CanvasData> {
    // Both host and client apply immediately (client-side prediction for real-time drawing)

    switch (input.type) {
      case "draw":
        return {
          ...state,
          data: {
            ...state.data,
            strokes: [...state.data.strokes, input.stroke],
          },
          updatedAt: Date.now(),
        };

      case "clear":
        return {
          ...state,
          data: {
            ...state.data,
            strokes: [],
          },
          updatedAt: Date.now(),
        };

      default:
        return state;
    }
  }

  render(
    state: GameSession<CanvasData>,
    myId: string,
    isHost: boolean,
    onInput: (input: CanvasInput) => void
  ): React.ReactNode {
    return React.createElement(CanvasUI, {
      state,
      myId,
      onAction: onInput, // CanvasUI expects onAction
    });
  }
}
