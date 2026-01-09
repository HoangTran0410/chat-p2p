import { BaseGame } from "../BaseGame";
import { GameSession } from "../types";
import { YouTubeUI } from "./YouTubeUI";
import React from "react";

// Game state
export interface YouTubeData {
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
}

// Input types
export type YouTubeInput =
  | { type: "load_video"; videoId: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number };

export class YouTubeSync extends BaseGame<YouTubeData, YouTubeInput> {
  readonly gameId = "youtube";
  readonly gameName = "Watch Together";
  readonly gameIcon = "📺";
  readonly gameDescription = "Watch YouTube videos together";

  createInitialState(hostId: string, clientId: string): YouTubeData {
    return {
      videoId: null,
      isPlaying: false,
      currentTime: 0,
    };
  }

  handleInput(
    state: GameSession<YouTubeData>,
    input: YouTubeInput,
    playerId: string,
    isHost: boolean
  ): GameSession<YouTubeData> {
    // Both host and client apply immediately (realtime sync)

    switch (input.type) {
      case "load_video":
        return {
          ...state,
          data: {
            videoId: input.videoId,
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
            currentTime: input.time,
          },
          updatedAt: Date.now(),
        };

      case "pause":
        return {
          ...state,
          data: {
            ...state.data,
            isPlaying: false,
            currentTime: input.time,
          },
          updatedAt: Date.now(),
        };

      case "seek":
        return {
          ...state,
          data: {
            ...state.data,
            currentTime: input.time,
          },
          updatedAt: Date.now(),
        };

      default:
        return state;
    }
  }

  render(
    state: GameSession<YouTubeData>,
    myId: string,
    isHost: boolean,
    onInput: (input: YouTubeInput) => void
  ): React.ReactNode {
    return React.createElement(YouTubeUI, {
      state,
      myId,
      onAction: onInput, // YouTubeUI expects onAction
    });
  }
}
