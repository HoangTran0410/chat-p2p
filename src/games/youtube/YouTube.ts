import { BaseRealTimeGame } from "../BaseRealTimeGame";
import { GameSession, RealTimeAction } from "../types";
import { YouTubeUI } from "./YouTubeUI";
import React from "react";

// Game state
export interface YouTubeData {
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
}

// Action types
export type YouTubeAction =
  | { type: "load_video"; videoId: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number };

export class YouTubeSync extends BaseRealTimeGame<YouTubeData, YouTubeAction> {
  readonly gameId = "youtube";
  readonly gameName = "Watch Together";
  readonly gameIcon = "📺";
  readonly gameDescription = "Watch YouTube videos together";

  createInitialState(hostId: string, guestId: string): YouTubeData {
    return {
      videoId: null,
      isPlaying: false,
      currentTime: 0,
    };
  }

  applyAction(
    state: GameSession<YouTubeData>,
    action: RealTimeAction<YouTubeAction>
  ): GameSession<YouTubeData> {
    const { payload } = action;

    switch (payload.type) {
      case "load_video":
        return {
          ...state,
          data: {
            videoId: payload.videoId,
            isPlaying: false,
            currentTime: 0,
          },
          updatedAt: Date.now(),
        };

      case "play":
        return {
          ...state,
          data: {
            ...state.data,
            isPlaying: true,
            currentTime: payload.time,
          },
          updatedAt: Date.now(),
        };

      case "pause":
        return {
          ...state,
          data: {
            ...state.data,
            isPlaying: false,
            currentTime: payload.time,
          },
          updatedAt: Date.now(),
        };

      case "seek":
        return {
          ...state,
          data: {
            ...state.data,
            currentTime: payload.time,
          },
          updatedAt: Date.now(),
        };

      default:
        return state;
    }
  }

  renderGame(
    state: GameSession<YouTubeData>,
    myId: string,
    onAction: (payload: YouTubeAction) => void
  ): React.ReactNode {
    return React.createElement(YouTubeUI, {
      state,
      myId,
      onAction,
    });
  }
}
