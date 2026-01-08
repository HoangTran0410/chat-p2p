import React, { useRef, useEffect, useState } from "react";
import { GameSession } from "../types";
import { YouTubeData, YouTubeAction } from "./YouTube";
import { Play, Pause, Link } from "lucide-react";

interface YouTubeUIProps {
  state: GameSession<YouTubeData>;
  myId: string;
  onAction: (action: YouTubeAction) => void;
}

// Declare YouTube API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubeUI({ state, myId, onAction }: YouTubeUIProps) {
  const playerRef = useRef<any>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isAPIReady, setIsAPIReady] = useState(false);
  const ignoreNextEvent = useRef(false);
  const isHost = myId === state.hostId;

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) {
      setIsAPIReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsAPIReady(true);
    };
  }, []);

  // Create/update player when videoId changes
  useEffect(() => {
    if (!isAPIReady || !state.data.videoId) return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    // Create new player
    playerRef.current = new window.YT.Player("youtube-player", {
      videoId: state.data.videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handlePlayerStateChange,
      },
    });
  }, [isAPIReady, state.data.videoId]);

  // Sync player state with game state
  useEffect(() => {
    if (!playerRef.current || !playerRef.current.getPlayerState) return;
    if (ignoreNextEvent.current) return;

    const player = playerRef.current;

    // Sync playing state
    if (state.data.isPlaying) {
      if (player.getPlayerState() !== 1) {
        // Not playing
        ignoreNextEvent.current = true;
        player.playVideo();
        setTimeout(() => (ignoreNextEvent.current = false), 500);
      }
    } else {
      if (player.getPlayerState() === 1) {
        // Playing
        ignoreNextEvent.current = true;
        player.pauseVideo();
        setTimeout(() => (ignoreNextEvent.current = false), 500);
      }
    }

    // Sync time (if difference > 2 seconds)
    const currentTime = player.getCurrentTime();
    if (Math.abs(currentTime - state.data.currentTime) > 2) {
      ignoreNextEvent.current = true;
      player.seekTo(state.data.currentTime, true);
      setTimeout(() => (ignoreNextEvent.current = false), 500);
    }
  }, [state.data.isPlaying, state.data.currentTime, state.updatedAt]);

  const handlePlayerReady = (event: any) => {
    playerRef.current = event.target;
  };

  const handlePlayerStateChange = (event: any) => {
    if (ignoreNextEvent.current) return;

    const player = event.target;
    const currentTime = player.getCurrentTime();

    // 1 = playing, 2 = paused
    if (event.data === 1) {
      onAction({ type: "play", time: currentTime });
    } else if (event.data === 2) {
      onAction({ type: "pause", time: currentTime });
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleLoadVideo = () => {
    const videoId = extractVideoId(urlInput);
    if (videoId) {
      onAction({ type: "load_video", videoId });
      setUrlInput("");
    } else {
      alert("Invalid YouTube URL or video ID");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-2 md:p-4 w-full h-full max-w-full md:max-w-6xl mx-auto">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadVideo();
            }}
            placeholder="Paste YouTube URL or video ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <button
          onClick={handleLoadVideo}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white font-medium transition-colors"
        >
          Load
        </button>
      </div>

      {/* Video Player */}
      {state.data.videoId ? (
        <div className="relative w-full flex-1 bg-black rounded-lg overflow-hidden min-h-[400px] md:min-h-[500px]">
          <div
            id="youtube-player"
            className="absolute inset-0"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-lg border-2 border-dashed border-slate-700">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">📺</div>
            <div className="text-slate-300 font-semibold mb-2">
              No video loaded
            </div>
            <div className="text-sm text-slate-500">
              Paste a YouTube URL above to start watching together
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-slate-500 flex items-center justify-between">
        <span>You are {isHost ? "Host" : "Guest"}</span>
        {state.data.videoId && (
          <span className="flex items-center gap-2">
            {state.data.isPlaying ? (
              <>
                <Play className="w-3 h-3 text-green-400" />
                Playing
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 text-yellow-400" />
                Paused
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
