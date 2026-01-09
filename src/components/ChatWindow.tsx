import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Trash2,
  ChevronLeft,
  Shield,
  Globe,
  Users,
  Check,
  Activity,
  RefreshCw,
  XCircle,
  AlertCircle,
  X,
  MessageSquare,
  Edit2,
  Save,
  Info,
  Clock,
  CheckCheck,
  Calendar,
  Paperclip,
  File as FileIcon,
  Lock,
  LockOpen,
  Columns,
} from "lucide-react";
import { Message, FILE_CHUNK_SIZE, MAX_FILE_SIZE_WARNING } from "../types";
import { PeerConnectionStatus } from "../types";
import { format } from "date-fns";
import { generateId } from "../services/storage";
import { useAppStore, useP2PStore } from "../stores";
import { useGameStore } from "../stores/gameStore";
import { GameSelector } from "./GameSelector";
import { GameContainer } from "./GameContainer";
import { Gamepad2 } from "lucide-react";
import { gameRegistry } from "../games";

interface ChatWindowProps {
  onSendMessage: (content: string | Partial<Message>) => void;
  onResendMessage: (messageId: string) => void;
  onRequestSync: () => void;
  // Chunked file transfer
  onSendFileChunked?: (
    fileId: string,
    file: File,
    messageType: "image" | "video" | "file"
  ) => void;
  sendingProgress?: { fileId: string; progress: number } | null;
  receivingProgress?: {
    fileId: string;
    fileName: string;
    progress: number;
  } | null;
  // E2EE
  peerFingerprint?: string | null;
  isEncrypted?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  onSendMessage,
  onResendMessage,
  onRequestSync,
  onSendFileChunked,
  sendingProgress,
  receivingProgress,
  peerFingerprint,
  isEncrypted,
}) => {
  // Get state and actions from stores
  const {
    backToSidebar,
    chats,
    typingStates,
    selectedPeerId,
    renameChat,
    deleteChat,
  } = useAppStore();
  const {
    myId,
    isReady,
    peerError,
    activeConnectionsCount,
    sendMessage,
    connectionStates,
    updateId,
    connectToPeer,
    disconnectPeer,
  } = useP2PStore();

  // Use selectedPeerId as peerId
  const peerId = selectedPeerId || "";

  // Derive values from stores
  const session = peerId ? chats[peerId] : undefined;
  const totalChats = Object.keys(chats).length;
  const isPeerTyping = peerId ? typingStates[peerId] ?? false : false;
  const connectionState: PeerConnectionStatus = peerId
    ? connectionStates[peerId] || "disconnected"
    : "disconnected";

  const handleRetry = () => {
    if (myId) updateId(myId);
  };

  const handleConnect = () => {
    if (peerId) connectToPeer(peerId);
  };

  const handleCancelConnection = () => {
    if (peerId) disconnectPeer(peerId);
  };

  const handleDeleteChat = () => {
    if (peerId) deleteChat(peerId, disconnectPeer);
  };

  const handleRenameChat = (newName: string) => {
    if (peerId) renameChat(peerId, newName);
  };

  const [inputText, setInputText] = useState("");
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(
    null
  );
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File size warning state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showFileSizeWarning, setShowFileSizeWarning] = useState(false);

  // Game state
  const [showGameSelector, setShowGameSelector] = useState(false);
  const {
    createGame,
    pendingInvites,
    acceptInvite,
    declineInvite,
    activeGame,
  } = useGameStore();

  // PC Layout State
  const [layout, setLayout] = useState<"vertical" | "horizontal">("horizontal");

  // Typing timeout refs
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Mobile Tabs
  const [mobileTab, setMobileTab] = useState<"chat" | "game">("chat");
  const [lastReadTime, setLastReadTime] = useState(Date.now());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Update last read time when entering chat tab
  useEffect(() => {
    if (mobileTab === "chat") {
      setLastReadTime(Date.now());
      scrollToBottom();
    }
  }, [mobileTab, session?.messages.length]);

  const unreadCount =
    session?.messages.filter(
      (m) => m.timestamp > lastReadTime && m.senderId !== myId
    ).length || 0;

  // Auto-switch to game tab if game starts (and we are on mobile)
  useEffect(() => {
    const { activeGame } = useGameStore.getState();
    if (activeGame?.status === "playing" && window.innerWidth < 768) {
      setMobileTab("game");
    }
  }, [useGameStore.getState().activeGame?.status]);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isPeerTyping]);

  // Internal typing handler
  const sendTypingEvent = (isTyping: boolean) => {
    if (sendMessage && peerId && connectionState === "connected") {
      sendMessage(peerId, { type: "typing", isTyping });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);

    if (sendMessage && connectionState === "connected") {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTypingEvent(true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTypingEvent(false);
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
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTypingEvent(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size warning
    if (file.size > MAX_FILE_SIZE_WARNING) {
      setPendingFile(file);
      setShowFileSizeWarning(true);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    await processAndSendFile(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processAndSendFile = async (file: File) => {
    let type: "image" | "video" | "file" = "file";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";

    // Use chunked transfer for large files or if callback provided
    if (onSendFileChunked && file.size > FILE_CHUNK_SIZE * 2) {
      const fileId = generateId();
      onSendFileChunked(fileId, file, type);
      return;
    }

    // Small files: send directly
    const arrayBuffer = await file.arrayBuffer();
    const messageData = {
      type,
      content: file.name,
      file: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        data: arrayBuffer,
      },
    };
    onSendMessage(messageData);
  };

  const handleConfirmLargeFile = async () => {
    if (pendingFile) {
      await processAndSendFile(pendingFile);
      setPendingFile(null);
    }
    setShowFileSizeWarning(false);
  };

  const handleCancelLargeFile = () => {
    setPendingFile(null);
    setShowFileSizeWarning(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // --- DASHBOARD VIEW (No Peer Selected) ---
  if (!peerId) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
        <div className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full flex flex-col">
          {/* Mobile Back Button */}
          <div className="md:hidden flex items-center mb-4">
            <button
              onClick={backToSidebar}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Chats</span>
            </button>
          </div>

          {/* Hero Section */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="mb-6">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  isReady
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-yellow-500/10 border border-yellow-500/30"
                }`}
              >
                <Activity
                  className={`w-10 h-10 ${
                    isReady ? "text-green-500" : "text-yellow-500 animate-pulse"
                  }`}
                />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {isReady ? "You're Online" : "Connecting..."}
              </h1>
              <p className="text-slate-400 text-sm max-w-md">
                {isReady
                  ? "Your P2P connection is active. Select a chat to start messaging."
                  : "Establishing secure connection to the network..."}
              </p>
              {peerError && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-sm text-red-400">{peerError}</span>
                  <button
                    onClick={handleRetry}
                    className="text-sm text-primary-400 hover:text-primary-300 underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 text-center">
              <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="text-2xl font-bold text-white">
                  {activeConnectionsCount}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
                  Active
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="text-2xl font-bold text-white">
                  {totalChats}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
                  Chats
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-center gap-6 text-xs text-slate-600 border-t border-slate-800 pt-6">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>E2E Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Serverless</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>WebRTC</span>
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
          text: "Connected",
          subtext: "End-to-end encrypted",
          icon: <Shield className="w-3 h-3" />,
        };
      case "connecting":
        return {
          color: "bg-yellow-500 animate-pulse",
          text: "Connecting...",
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
    <div className="flex-1 flex h-full bg-slate-950 relative">
      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          showInfoPanel ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Enhanced Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={backToSidebar}
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
                {/* E2EE Badge */}
                {isConnected && (
                  <span
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      isEncrypted
                        ? "bg-primary-500/10 text-primary-400"
                        : "bg-slate-700/50 text-slate-500"
                    }`}
                    title={
                      peerFingerprint ||
                      (isEncrypted ? "E2EE Active" : "Unencrypted")
                    }
                  >
                    {isEncrypted ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : (
                      <LockOpen className="w-2.5 h-2.5" />
                    )}
                    {isEncrypted ? "E2EE" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 pl-2">
            {connectionState === "connecting" && (
              <button
                onClick={handleCancelConnection}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}

            {(connectionState === "failed" ||
              connectionState === "disconnected") && (
              <button
                onClick={handleConnect}
                className="px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            )}

            {/* Layout Toggle (Desktop Only) */}
            {activeGame && (
              <button
                onClick={() =>
                  setLayout(layout === "vertical" ? "horizontal" : "vertical")
                }
                className="hidden md:block p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={
                  layout === "vertical"
                    ? "Switch to Split View"
                    : "Switch to Stacked View"
                }
              >
                {layout === "vertical" ? (
                  <Columns className="w-5 h-5 rotate-90" />
                ) : (
                  <Columns className="w-5 h-5" />
                )}
              </button>
            )}

            <button
              onClick={() => setShowInfoPanel(!showInfoPanel)}
              className={`p-2 rounded-lg transition-colors ${
                showInfoPanel
                  ? "text-primary-400 bg-primary-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Conversation Info"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={backToSidebar}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden md:block"
              title="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden flex border-b border-slate-800 bg-slate-900/50">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-3 text-sm font-medium relative ${
              mobileTab === "chat" ? "text-primary-400" : "text-slate-400"
            }`}
          >
            Chat
            {unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
            {mobileTab === "chat" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500" />
            )}
          </button>
          <button
            onClick={() => setMobileTab("game")}
            className={`flex-1 py-3 text-sm font-medium relative ${
              mobileTab === "game" ? "text-primary-400" : "text-slate-400"
            }`}
          >
            Game
            {mobileTab === "game" && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500" />
            )}
          </button>
        </div>

        {/* Pending Game Invites */}
        {pendingInvites.map((invite) => {
          if (invite.hostId !== peerId) return null;
          const gameDef = gameRegistry.getDefinition(invite.gameType);
          if (!gameDef) return null;

          return (
            <div
              key={invite.sessionId}
              className="mx-4 mt-4 p-3 bg-slate-800/80 border border-slate-700 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{gameDef.icon}</div>
                <div>
                  <div className="font-medium text-slate-200">
                    Game Invite: {gameDef.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    Invited you to play
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => declineInvite(invite.sessionId)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => acceptInvite(invite.sessionId)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-md transition-colors shadow-lg shadow-primary-900/20"
                >
                  Accept
                </button>
              </div>
            </div>
          );
        })}

        {/* Content Area - Responsive Layout */}
        <div
          className={`flex-1 flex flex-col min-h-0 ${
            layout === "horizontal" ? "md:flex-row" : "md:flex-col"
          }`}
        >
          {/* Game UI Wrapper - Comes first in vertical (top), stays right in horizontal */}
          {(activeGame || mobileTab === "game") && (
            <div
              className={`
                ${mobileTab === "game" ? "flex" : "hidden"}
                ${activeGame ? "md:flex" : ""}
                flex-1 flex-col min-h-0 min-w-0 overflow-y-auto
                ${
                  layout === "horizontal"
                    ? "md:order-2"
                    : "md:order-1 md:border-b md:border-slate-800"
                }
              `}
            >
              <GameContainer />

              {/* Mobile Game List (Empty State) */}
              {!activeGame && (
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-slate-700 rotate-3">
                    <Gamepad2 className="w-8 h-8 text-primary-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Play a Game
                  </h3>
                  <p className="text-slate-400 mb-8 max-w-xs text-sm leading-relaxed">
                    Challenge your friend to a game directly in the chat. Select
                    a game below to send an invite.
                  </p>

                  <div className="grid gap-3 w-full max-w-sm">
                    {gameRegistry.getAllDefinitions().map((game) => (
                      <button
                        key={game.id}
                        onClick={() => {
                          if (peerId) {
                            createGame(game.id, peerId);
                          }
                        }}
                        className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-primary-500/50 rounded-xl transition-all group text-left"
                      >
                        <div className="text-3xl group-hover:scale-110 transition-transform duration-300 bg-slate-900 rounded-lg p-2">
                          {game.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-200 group-hover:text-primary-400 transition-colors">
                            {game.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {game.description}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                          <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages Wrapper - Comes second in vertical (bottom), stays left in horizontal */}
          <div
            className={`
              ${mobileTab === "chat" ? "flex" : "hidden"}
              md:flex
              flex-1 flex-col min-h-0 min-w-0
              ${
                layout === "horizontal"
                  ? "md:order-1 md:border-r md:border-slate-800"
                  : "md:order-2"
              }
            `}
          >
            {/* Scrollable Messages Area */}
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
                      <p className="text-red-400/80">
                        Could not connect to peer.
                      </p>
                      <button
                        onClick={handleConnect}
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
                    msg.timestamp - session.messages[index - 1].timestamp >
                      300000; // 5 mins

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
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          onClick={() =>
                            setExpandedMessageId(
                              expandedMessageId === msg.id ? null : msg.id
                            )
                          }
                          className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words cursor-pointer transition-all hover:opacity-90 ${
                            isMe
                              ? "bg-primary-600 text-white rounded-br-sm"
                              : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm"
                          }`}
                        >
                          <MessageContent message={msg} />
                          <div
                            className={`text-[10px] mt-1 flex items-center gap-1 ${
                              isMe ? "text-primary-200" : "text-slate-500"
                            }`}
                          >
                            {/* Encryption indicator */}
                            {msg.encrypted ? (
                              <Lock className="w-2.5 h-2.5 opacity-60" />
                            ) : (
                              <LockOpen className="w-2.5 h-2.5 opacity-40" />
                            )}
                            {format(msg.timestamp, "h:mm a")}
                            {isMe && msg.status && (
                              <span className="ml-1">
                                {msg.status === "read" && (
                                  <CheckCheck className="w-3 h-3" />
                                )}
                                {msg.status === "delivered" && (
                                  <Check className="w-3 h-3" />
                                )}
                                {msg.status === "sent" && (
                                  <Check className="w-3 h-3 opacity-50" />
                                )}
                                {msg.status === "failed" && (
                                  <AlertCircle className="w-3 h-3 text-red-200" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Failed message action */}
                        {isMe && msg.status === "failed" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResendMessage(msg.id);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-1 px-1 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Tap to retry
                          </button>
                        )}
                        {/* Expanded Details */}
                        {expandedMessageId === msg.id && (
                          <div
                            className={`mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1 max-w-[85%] ${
                              isMe ? "mr-0" : "ml-0"
                            }`}
                          >
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                Sent:{" "}
                                {format(msg.timestamp, "MMM d, yyyy h:mm:ss a")}
                              </span>
                            </div>
                            {msg.receivedAt && (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Check className="w-3 h-3" />
                                <span>
                                  Delivered:{" "}
                                  {format(msg.receivedAt, "h:mm:ss a")}
                                </span>
                              </div>
                            )}
                            {msg.readAt && (
                              <div className="flex items-center gap-2 text-slate-400">
                                <CheckCheck className="w-3 h-3" />
                                <span>
                                  Read: {format(msg.readAt, "h:mm:ss a")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
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

            {/* Input Area */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 safe-area-bottom">
              <form
                onSubmit={handleSubmit}
                className={`relative flex items-end gap-0 md:gap-2 p-2 rounded-xl border ${
                  isConnected
                    ? "border-slate-700 bg-slate-900 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/50"
                    : "border-slate-800 bg-slate-900/50 opacity-75"
                } transition-all`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowGameSelector(!showGameSelector)}
                  disabled={!isConnected}
                  className={`hidden md:block p-2.5 rounded-lg mb-0.5 transition-all text-slate-400 hover:text-white hover:bg-slate-800 ${
                    !isConnected ? "cursor-not-allowed opacity-50" : ""
                  } ${showGameSelector ? "bg-slate-800 text-white" : ""}`}
                  title="Play a game"
                >
                  <Gamepad2 className="w-5 h-5" />
                </button>

                {showGameSelector && (
                  <GameSelector
                    onSelect={(gameId) => {
                      if (peerId) {
                        createGame(gameId, peerId);
                        setShowGameSelector(false);
                        // Switch to game tab on mobile
                        if (window.innerWidth < 768) {
                          setMobileTab("game");
                        }
                      }
                    }}
                    onClose={() => setShowGameSelector(false)}
                  />
                )}

                {/* <button
                  type="button"
                  onClick={triggerFileSelect}
                  disabled={!isConnected}
                  className={`p-2.5 rounded-lg mb-0.5 transition-all text-slate-400 hover:text-white hover:bg-slate-800 ${
                    !isConnected ? "cursor-not-allowed opacity-50" : ""
                  }`}
                  title="Attach File"
                >
                  <Paperclip className="w-5 h-5" />
                </button> */}
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={!isConnected}
                  placeholder={
                    isConnected
                      ? "Type a message..."
                      : `Status: ${statusConfig.text}`
                  }
                  className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none py-2.5 px-2 max-h-32 text-sm disabled:opacity-50 outline-none"
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
        </div>
      </div>

      {/* Info Panel */}
      {showInfoPanel && (
        <div className="w-full md:w-80 border-l border-slate-800 bg-slate-900 flex flex-col overflow-y-auto">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-white">Conversation Info</h3>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Peer Info */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isConnected ? "bg-green-500/20" : "bg-slate-700"
                }`}
              >
                <Users
                  className={`w-6 h-6 ${
                    isConnected ? "text-green-400" : "text-slate-400"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-primary-500 outline-none"
                      placeholder="Enter nickname..."
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        handleRenameChat(tempName);
                        setIsEditingName(false);
                      }}
                      className="p-1 bg-primary-600 hover:bg-primary-500 text-white rounded"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">
                      {session?.name || "Peer"}
                    </p>
                    <button
                      onClick={() => {
                        setTempName(session?.name || "");
                        setIsEditingName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      title="Edit name"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400 font-mono truncate">
                  {peerId}
                </p>
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnected
                  ? "bg-green-500/20 text-green-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${statusConfig.color}`}
              ></span>
              {statusConfig.text}
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Total Messages
              </span>
              <span className="text-white font-medium">
                {session?.messages.length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                First Message
              </span>
              <span className="text-white font-medium">
                {session?.messages[0]
                  ? format(session.messages[0].timestamp, "MMM d, yyyy")
                  : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last Activity
              </span>
              <span className="text-white font-medium">
                {session?.lastUpdated
                  ? format(session.lastUpdated, "MMM d, h:mm a")
                  : "-"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2">
            {isConnected && (
              <button
                onClick={onRequestSync}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Sync History
              </button>
            )}
            {!isConnected && (
              <button
                onClick={handleConnect}
                className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Reconnect
              </button>
            )}
            <button
              onClick={handleDeleteChat}
              className="w-full py-2.5 px-4 bg-red-950/50 hover:bg-red-950 text-red-400 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Conversation
            </button>
          </div>
        </div>
      )}

      {/* File Size Warning Modal */}
      {/* {showFileSizeWarning && pendingFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Large File</h3>
                <p className="text-sm text-slate-400">
                  {(pendingFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
            <p className="text-slate-300 mb-6 text-sm">
              This file is larger than 50MB. Sending large files may take a
              while and could fail on slow connections.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelLargeFile}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLargeFile}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
              >
                Send Anyway
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Sending Progress Overlay */}
      {/* {sendingProgress && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 shadow-xl z-40 flex items-center gap-3 min-w-[200px]">
          <div className="animate-spin">
            <RefreshCw className="w-4 h-4 text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400 mb-1">Sending file...</p>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-200"
                style={{ width: `${sendingProgress.progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-white">
            {sendingProgress.progress}%
          </span>
        </div>
      )} */}

      {/* Receiving Progress Overlay */}
      {/* {receivingProgress && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 shadow-xl z-40 flex items-center gap-3 min-w-[200px]">
          <div className="animate-spin">
            <RefreshCw className="w-4 h-4 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400 mb-1 truncate max-w-[120px]">
              Receiving: {receivingProgress.fileName}
            </p>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-200"
                style={{ width: `${receivingProgress.progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-white">
            {receivingProgress.progress}%
          </span>
        </div>
      )} */}
    </div>
  );
};

function MessageContent({ message }: { message: Message }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (
      message.file?.data &&
      (message.type === "image" || message.type === "video")
    ) {
      const blob =
        message.file.data instanceof Blob
          ? message.file.data
          : new Blob([message.file.data as any]);

      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [message]);

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!message.file) return;

    const blob =
      message.file.data instanceof Blob
        ? message.file.data
        : new Blob([message.file.data as any]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = message.file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (message.type === "image" && objectUrl) {
    return (
      <div className="mb-2 max-w-sm relative group">
        <img
          src={objectUrl}
          alt={message.content}
          className="rounded-lg border border-slate-700 w-full h-auto object-contain"
        />
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Download"
        >
          <div className="w-4 h-4">
            <Save className="w-4 h-4" />
          </div>
        </button>
      </div>
    );
  }

  if (message.type === "video" && objectUrl) {
    return (
      <div className="mb-2 max-w-sm relative group">
        <video
          src={objectUrl}
          controls
          className="rounded-lg border border-slate-700 w-full"
        />
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Download"
        >
          <div className="w-4 h-4">
            <Save className="w-4 h-4" />
          </div>
        </button>
      </div>
    );
  }

  if (message.type === "file" && message.file) {
    return (
      <div className="mb-2 p-3 bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-3 w-fit hover:bg-slate-750 transition-colors">
        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
          <FileIcon className="w-5 h-5 text-primary-400" />
        </div>
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-sm font-medium text-slate-200 truncate max-w-[150px]">
            {message.file.name}
          </p>
          <p className="text-xs text-slate-400">
            {(message.file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded"
          title="Download"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm border-b border-slate-800/50 pb-2 mb-2 whitespace-pre-wrap">
      {message.content}
    </div>
  );
}
