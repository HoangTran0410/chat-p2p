import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Trash2,
  ChevronLeft,
  Shield,
  Globe,
  Users,
  Copy,
  Check,
  Activity,
  RefreshCw,
  XCircle,
  AlertCircle,
  X,
  MessageSquare,
  Shuffle,
  Edit2,
  Save,
} from "lucide-react";
import { ChatSession, PeerConnectionStatus } from "../types";
import { format } from "date-fns";

interface ChatWindowProps {
  myId: string;
  peerId: string;
  session?: ChatSession;
  connectionState: PeerConnectionStatus;
  onSendMessage: (content: string) => void;
  onDeleteChat: () => void;
  onBack: () => void;
  onConnect: () => void;
  onCancelConnection: () => void;

  // Dashboard stats
  isReady: boolean;
  activeConnectionsCount: number;
  totalChats: number;

  // Typing
  isPeerTyping?: boolean;
  onTyping?: (isTyping: boolean) => void;

  // Identity actions
  peerError: string | null;
  onRetry: () => void;
  onRandomId: () => void;
  onUpdateId: (newId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  myId,
  peerId,
  session,
  connectionState,
  onSendMessage,
  onDeleteChat,
  onBack,
  onConnect,
  onCancelConnection,
  isReady,
  activeConnectionsCount,
  totalChats,
  isPeerTyping = false,
  onTyping,
  peerError,
  onRetry,
  onRandomId,
  onUpdateId,
}) => {
  const [inputText, setInputText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEditingId, setIsEditingId] = useState(false);
  const [tempId, setTempId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Typing timeout refs
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);

    if (onTyping && connectionState === "connected") {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText("");

      // Stop typing immediately on send
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current && onTyping) {
        isTypingRef.current = false;
        onTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- DASHBOARD VIEW (No Peer Selected) ---
  if (!peerId) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
        <div className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full flex flex-col gap-8">
          {/* Mobile Back Button */}
          <div className="md:hidden flex items-center mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Chats</span>
            </button>
          </div>

          {/* Dashboard Header */}
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Overview</h1>
            <p className="text-slate-400">
              Manage your secure P2P connections and identity.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${
                  isReady
                    ? "bg-green-500/10 text-green-500"
                    : "bg-yellow-500/10 text-yellow-500"
                }`}
              >
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-slate-400">Network Status</div>
                <div className="font-semibold text-lg text-slate-100">
                  {isReady ? "Online" : "Connecting..."}
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-slate-400">Active Sessions</div>
                <div className="font-semibold text-lg text-slate-100">
                  {activeConnectionsCount}
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-slate-400">
                  Total Conversations
                </div>
                <div className="font-semibold text-lg text-slate-100">
                  {totalChats}
                </div>
              </div>
            </div>
          </div>

          {/* Identity Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-primary-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-600/20 transition-all duration-700"></div>

            <div className="relative z-10">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-400" />
                Your Digital Identity
              </h3>
              {isEditingId ? (
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="text"
                    value={tempId}
                    onChange={(e) => setTempId(e.target.value)}
                    className="flex-1 text-xl font-mono bg-slate-950 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (tempId && /^[a-zA-Z0-9-_]+$/.test(tempId)) {
                        onUpdateId(tempId);
                        setIsEditingId(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-medium transition-colors text-white"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingId(false)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors text-slate-200"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <code className="block text-2xl md:text-3xl font-mono text-white tracking-tight break-all mb-4">
                    {myId || "Generating ID..."}
                  </code>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setTempId(myId);
                        setIsEditingId(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium transition-colors text-slate-200"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit ID
                    </button>
                    <button
                      onClick={onRandomId}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium transition-colors text-slate-200"
                    >
                      <Shuffle className="w-4 h-4" />
                      New ID
                    </button>
                    <button
                      onClick={handleCopyId}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium transition-colors text-slate-200"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied" : "Copy ID"}
                    </button>
                    {peerError && (
                      <button
                        onClick={onRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/30 rounded-lg text-sm font-medium transition-colors text-primary-400"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </button>
                    )}
                  </div>
                </>
              )}
              {peerError && (
                <div className="mt-3 text-sm text-red-400 font-medium">
                  {peerError}
                </div>
              )}
              <p className="mt-4 text-sm text-slate-400 max-w-2xl">
                This ID allows others to connect with you securely. Share it
                only with trusted peers. Connections are established directly
                between devices.
              </p>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-500 border-t border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>End-to-End Encrypted Transport</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Serverless Architecture</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>WebRTC P2P Protocol</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- CHAT VIEW ---

  // Status Config Helper
  const getStatusConfig = () => {
    switch (connectionState) {
      case "connected":
        return {
          color: "bg-green-500",
          text: "Securely Connected",
          subtext: "End-to-end encrypted",
          icon: <Shield className="w-3 h-3" />,
        };
      case "connecting":
        return {
          color: "bg-yellow-500 animate-pulse",
          text: "Requesting Connection...",
          subtext: "Waiting for peer response",
          icon: <Activity className="w-3 h-3 animate-spin" />,
        };
      case "failed":
        return {
          color: "bg-red-500",
          text: "Connection Failed",
          subtext: "Peer offline or not found",
          icon: <AlertCircle className="w-3 h-3" />,
        };
      default: // disconnected
        return {
          color: "bg-slate-600",
          text: "Disconnected",
          subtext: "Session offline",
          icon: <XCircle className="w-3 h-3" />,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const isConnected = connectionState === "connected";

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative">
      {/* Enhanced Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2 truncate text-base">
              <span
                className={`${
                  session?.name ? "font-sans" : "font-mono tracking-wide"
                } truncate`}
              >
                {session?.name || peerId}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${statusConfig.color}`}
              ></span>
              <span
                className={`${
                  connectionState === "failed"
                    ? "text-red-400"
                    : "text-slate-400"
                } flex items-center gap-1.5`}
              >
                {session?.name && (
                  <span className="text-slate-500 font-mono tracking-tight mr-1 border-r border-slate-800 pr-2">
                    {peerId}
                  </span>
                )}
                {statusConfig.text}
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 pl-2">
          {connectionState === "connecting" && (
            <button
              onClick={onCancelConnection}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}

          {(connectionState === "failed" ||
            connectionState === "disconnected") && (
            <button
              onClick={onConnect}
              className="px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect
            </button>
          )}

          <button
            onClick={onDeleteChat}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
            title="Delete Conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden md:block"
            title="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!session || session.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm p-4 text-center">
            {connectionState === "connecting" ? (
              <div className="flex flex-col items-center gap-3 animate-pulse">
                <Activity className="w-8 h-8 text-primary-500 opacity-50" />
                <p>Establishing secure connection...</p>
              </div>
            ) : connectionState === "failed" ? (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
                <p className="text-red-400/80">Could not connect to peer.</p>
                <button
                  onClick={onConnect}
                  className="text-primary-500 hover:underline"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <p>No messages yet. Say hello!</p>
            )}
          </div>
        ) : (
          session.messages.map((msg, index) => {
            const isMe = msg.senderId === myId;
            const showTimestamp =
              index === 0 ||
              msg.timestamp - session.messages[index - 1].timestamp > 300000; // 5 mins

            return (
              <div key={msg.id} className="space-y-2">
                {showTimestamp && (
                  <div className="flex justify-center my-4">
                    <span className="text-[10px] text-slate-600 bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-800">
                      {format(msg.timestamp, "MMM d, h:mm a")}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                      isMe
                        ? "bg-primary-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {isPeerTyping && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 w-fit">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 safe-area-bottom">
        <form
          onSubmit={handleSubmit}
          className={`relative flex items-end gap-2 p-2 rounded-xl border ${
            isConnected
              ? "border-slate-700 bg-slate-900 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/50"
              : "border-slate-800 bg-slate-900/50 opacity-75"
          } transition-all`}
        >
          <textarea
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            placeholder={
              isConnected ? "Type a message..." : `Status: ${statusConfig.text}`
            }
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none py-2.5 px-2 max-h-32 text-sm disabled:opacity-50"
            rows={1}
            style={{ minHeight: "44px" }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected}
            className={`p-2.5 rounded-lg mb-0.5 transition-all ${
              inputText.trim() && isConnected
                ? "bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-900/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
