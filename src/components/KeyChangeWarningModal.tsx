import React from "react";
import { AlertTriangle } from "lucide-react";

interface KeyChangeWarningModalProps {
  warning: {
    peerId: string;
    oldFingerprint: string;
    newFingerprint: string;
  } | null;
  peerName?: string;
  onDisconnect: () => void;
  onTrust: () => void;
}

export const KeyChangeWarningModal: React.FC<KeyChangeWarningModalProps> = ({
  warning,
  peerName,
  onDisconnect,
  onTrust,
}) => {
  if (!warning) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-yellow-500/30 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/10 rounded-full">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-lg font-medium text-white">
            Identity Key Changed
          </h3>
        </div>
        <p className="text-slate-400 mb-4">
          The identity key for{" "}
          <span className="font-mono text-yellow-400">
            {peerName || warning.peerId.slice(0, 12)}
          </span>{" "}
          has changed. This could indicate:
        </p>
        <ul className="text-sm text-slate-400 mb-4 space-y-1 ml-4">
          <li>• They reinstalled or cleared their data</li>
          <li>• Someone is impersonating them (MITM attack)</li>
        </ul>
        <p className="text-xs text-slate-500 mb-4">
          Verify their new fingerprint through a trusted channel before
          continuing.
        </p>
        <div className="bg-slate-800/50 rounded p-3 mb-4">
          <p className="text-xs text-slate-500 mb-1">New fingerprint:</p>
          <code className="text-xs font-mono text-yellow-400 break-all">
            {warning.newFingerprint.split(" ").slice(0, 8).join(" ")}
          </code>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onDisconnect}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Disconnect
          </button>
          <button
            onClick={onTrust}
            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
          >
            Trust New Key
          </button>
        </div>
      </div>
    </div>
  );
};
