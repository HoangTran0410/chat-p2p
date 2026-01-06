import React, { useState } from "react";
import { X, Users, Copy, Check } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (name: string) => string; // Returns room ID
  myId: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  myId,
}) => {
  const [roomName, setRoomName] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    const roomId = onCreateRoom(roomName.trim());
    setCreatedRoomId(roomId);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}#room=${createdRoomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setRoomName("");
    setCreatedRoomId(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {createdRoomId ? "Room Created!" : "Create Room"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!createdRoomId ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Team Chat, Gaming Squad..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  autoFocus
                  maxLength={50}
                />
              </div>

              <button
                type="submit"
                disabled={!roomName.trim()}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
              >
                Create Room
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-purple-600/20 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-slate-300">
                  Share this link with others to invite them:
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-2">
                <code className="flex-1 text-sm text-slate-300 font-mono truncate">
                  {`${window.location.origin}${window.location.pathname}#room=${createdRoomId}`}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Copy Link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
