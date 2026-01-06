import React from "react";
import { RefreshCw } from "lucide-react";

interface SyncModalProps {
  status: "idle" | "outgoing" | "incoming";
  targetPeerId: string | null;
  peerName?: string;
  progress?: { phase: string; count: number } | null;
  onCancel: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  status,
  targetPeerId,
  peerName,
  progress,
  onCancel,
  onAccept,
  onReject,
}) => {
  if (status === "idle") return null;

  // Outgoing sync modal
  if (status === "outgoing") {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="animate-spin">
              <RefreshCw className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">
                {progress ? progress.phase : "Waiting for confirmation..."}
              </h3>
              {progress && (
                <p className="text-sm text-slate-400">
                  {progress.count} messages
                </p>
              )}
            </div>
          </div>
          {progress ? (
            <div className="mb-4">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 animate-pulse w-full" />
              </div>
            </div>
          ) : (
            <p className="text-slate-400 mb-4">
              Asking peer to authorize history sync.
            </p>
          )}
          <button
            onClick={onCancel}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Incoming sync modal
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-medium text-white mb-2">Sync Request</h3>
        <p className="text-slate-400 mb-6">
          <span className="font-mono text-primary-400">
            {peerName || targetPeerId?.slice(0, 8)}
          </span>{" "}
          wants to sync chat history. This will merge messages on both devices.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
