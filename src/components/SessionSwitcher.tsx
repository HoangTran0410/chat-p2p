import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Plus,
  User,
  Check,
  Trash2,
  AlertTriangle,
  Copy,
  Circle,
} from "lucide-react";
import { UserSession } from "../types";

interface SessionSwitcherProps {
  sessions: UserSession[];
  activeSessionId: string;
  onSwitchSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  isReady: boolean;
  peerError?: string | null;
}

export const SessionSwitcher: React.FC<SessionSwitcherProps> = ({
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateNewSession,
  onDeleteSession,
  isReady,
  peerError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowDeleteConfirm(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (showDeleteConfirm === sessionId) {
      onDeleteSession(sessionId);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(sessionId);
    }
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(activeSessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button with Copy */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              {/* Status indicator */}
              <Circle
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${
                  peerError
                    ? "fill-red-500 text-red-500"
                    : isReady
                    ? "fill-green-500 text-green-500"
                    : "fill-yellow-500 text-yellow-500"
                }`}
              />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Your ID
              </span>
              <span className="text-sm text-slate-200 font-mono truncate max-w-[120px]">
                {activeSession?.name || activeSessionId}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Copy Button */}
        <button
          onClick={handleCopyId}
          className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          title="Copy ID"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="py-1 max-h-60 overflow-y-auto">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isDeleting = showDeleteConfirm === session.id;

              return (
                <div
                  key={session.id}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary-600/20 text-white"
                      : "hover:bg-slate-800 text-slate-300"
                  }`}
                  onClick={() => {
                    if (!isDeleting) {
                      onSwitchSession(session.id);
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isActive ? "bg-primary-600" : "bg-slate-700"
                      }`}
                    >
                      {isActive ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <User className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <span className="font-mono text-sm truncate">
                      {session.name || session.id}
                    </span>
                  </div>

                  {/* Delete button (only for non-active sessions) */}
                  {!isActive && sessions.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteClick(e, session.id)}
                      className={`p-1 rounded transition-colors ${
                        isDeleting
                          ? "bg-red-500/20 text-red-400"
                          : "hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                      }`}
                      title={
                        isDeleting ? "Click again to confirm" : "Delete session"
                      }
                    >
                      {isDeleting ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* New Session Button */}
          <div className="border-t border-slate-700">
            <button
              onClick={() => {
                onCreateNewSession();
                setIsOpen(false);
              }}
              disabled={!isReady}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-primary-400 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
