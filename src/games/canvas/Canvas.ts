import { BaseRealTimeGame } from "../BaseRealTimeGame";
import { GameSession, RealTimeAction } from "../types";
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

// Action types
export type CanvasAction =
  | { type: "draw"; stroke: DrawStroke }
  | { type: "clear" };

export class CollaborativeCanvas extends BaseRealTimeGame<
  CanvasData,
  CanvasAction
> {
  readonly gameId = "canvas";
  readonly gameName = "Draw Together";
  readonly gameIcon = "🎨";
  readonly gameDescription = "Collaborative drawing canvas";

  createInitialState(hostId: string, guestId: string): CanvasData {
    return {
      strokes: [],
    };
  }

  applyAction(
    state: GameSession<CanvasData>,
    action: RealTimeAction<CanvasAction>
  ): GameSession<CanvasData> {
    const { payload } = action;

    switch (payload.type) {
      case "draw":
        return {
          ...state,
          data: {
            ...state.data,
            strokes: [...state.data.strokes, payload.stroke],
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

  renderGame(
    state: GameSession<CanvasData>,
    myId: string,
    onAction: (payload: CanvasAction) => void
  ): React.ReactNode {
    return React.createElement(CanvasUI, {
      state,
      myId,
      onAction,
    });
  }
}
