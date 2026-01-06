import React, { useState, useEffect } from "react";
import { X, UserPlus } from "lucide-react";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (hostPeerId: string) => void;
  pendingRoomId?: string | null; // From URL hash
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  pendingRoomId,
}) => {
  const [roomIdOrLink, setRoomIdOrLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  // If there's a pending room from URL, pre-fill
  useEffect(() => {
    if (pendingRoomId) {
      setRoomIdOrLink(pendingRoomId);
    }
  }, [pendingRoomId]);

  if (!isOpen) return null;

  const extractRoomId = (input: string): string | null => {
    const trimmed = input.trim();

    // If it's a full URL with #room=
    if (trimmed.includes("#room=")) {
      const match = trimmed.match(/#room=(.+)/);
      if (match) return match[1];
    }

    // New format: room_{hostId}_{name}
    if (trimmed.startsWith("room_")) {
      return trimmed;
    }

    // Legacy format: room-{peerId}
    if (trimmed.startsWith("room-")) {
      return trimmed;
    }

    // If it's a bare peer ID, assume they want to join the user's "default" legacy room
    if (trimmed.length > 0 && !trimmed.includes("/")) {
      return `room-${trimmed}`;
    }

    return null;
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const roomId = extractRoomId(roomIdOrLink);
    if (!roomId) {
      setError("Invalid room ID or link. Please check and try again.");
      return;
    }

    onJoinRoom(roomId);
    handleClose();
  };

  const handleClose = () => {
    setRoomIdOrLink("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Join Room</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleJoin} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Room ID or Invite Link
            </label>
            <input
              type="text"
              value={roomIdOrLink}
              onChange={(e) => {
                setRoomIdOrLink(e.target.value);
                setError(null);
              }}
              placeholder="Paste room ID or link..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-1">Accepted formats:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>
                Full link:{" "}
                <code className="text-purple-400">
                  https://...#room=room_abc...
                </code>
              </li>
              <li>
                Room ID: <code className="text-purple-400">room_abc...</code>
              </li>
              <li>
                Host Peer ID: <code className="text-purple-400">abc123</code>
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={!roomIdOrLink.trim()}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
};
