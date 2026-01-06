import React, { useState, useRef } from "react";
import {
  X,
  Save,
  RotateCcw,
  Server,
  Shield,
  Download,
  Upload,
  Copy,
  Check,
} from "lucide-react";
import { PeerConfig } from "../types";
import { DEFAULT_PEER_CONFIG } from "../constants";

interface SettingsModalProps {
  config: PeerConfig;
  onSave: (config: PeerConfig) => void;
  onClose: () => void;
  onClearData: () => void;
  // E2EE props
  myFingerprint?: string | null;
  onExportKeys?: () => Promise<string | null>;
  onImportKeys?: (json: string) => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onSave,
  onClose,
  onClearData,
  myFingerprint,
  onExportKeys,
  onImportKeys,
}) => {
  const [formData, setFormData] = useState<PeerConfig>(config);
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? parseInt(value)
          : value,
    }));
  };

  const handleReset = () => {
    setFormData(DEFAULT_PEER_CONFIG);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-primary-500" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                PeerJS Host
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                placeholder="0.peerjs.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleChange}
                  placeholder="443"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Path
                </label>
                <input
                  type="text"
                  name="path"
                  value={formData.path}
                  onChange={handleChange}
                  placeholder="/myapp"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="secure"
                  checked={formData.secure}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-900"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Secure (HTTPS/WSS)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="debug"
                  checked={Boolean(formData.debug)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      debug: e.target.checked ? 3 : 0,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-900"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Debug Logs
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-primary-900/20"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </form>

        {/* Security Section */}
        {myFingerprint && (
          <div className="px-6 py-4 bg-primary-500/5 border-t border-primary-500/20">
            <h3 className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              End-to-End Encryption
            </h3>

            {/* Fingerprint */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">
                Your Identity Fingerprint
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-950 px-3 py-2 rounded text-xs font-mono text-slate-300 overflow-hidden text-ellipsis">
                  {myFingerprint.split(" ").slice(0, 8).join(" ")}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(myFingerprint);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                  title="Copy full fingerprint"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Export/Import Keys */}
            <div className="flex gap-2">
              {onExportKeys && (
                <button
                  type="button"
                  onClick={async () => {
                    const json = await onExportKeys();
                    if (json) {
                      const blob = new Blob([json], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "ping-identity-keys.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Keys
                </button>
              )}
              {onImportKeys && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const text = await file.text();
                        const success = await onImportKeys(text);
                        setImportStatus(success ? "success" : "error");
                        setTimeout(() => setImportStatus("idle"), 2000);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                      importStatus === "success"
                        ? "bg-green-500/20 text-green-400"
                        : importStatus === "error"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {importStatus === "success"
                      ? "Imported!"
                      : importStatus === "error"
                      ? "Failed"
                      : "Import Keys"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="px-6 py-4 bg-red-500/5 border-t border-red-500/20">
          <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">
            Danger Zone
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-400/80">
              Clear all chats, sessions, and local data.
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure? This will wipe ALL your data including chat history and sessions. This action cannot be undone."
                  )
                ) {
                  onClearData();
                }
              }}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-xs font-medium rounded transition-colors"
            >
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
