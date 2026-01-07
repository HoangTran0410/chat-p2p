import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  Pencil,
  LayoutDashboard,
  Settings,
  Github,
  Users,
  Crown,
  UserPlus,
  Share2,
  Check,
} from "lucide-react";
import { ChatSession, UserSession } from "../types";
import { RoomSession } from "../groupTypes";
import { formatDistanceToNow } from "date-fns";
import { SessionSwitcher } from "./SessionSwitcher";
import { useAppStore } from "../stores";
import { createInviteLink } from "../utils";

interface ChatSidebarProps {
  myId: string;
  chats: Record<string, ChatSession>;
  activeConnections: string[];
  onSelectPeer: (peerId: string) => void;
  onConnect: (peerId: string) => void;
  onRenameChat: (peerId: string, newName: string) => void;
  onShowDashboard: () => void;
  peerError: string | null;
  isReady: boolean;
  onRetry: () => void;
  // Session management props
  sessions: UserSession[];
  activeSessionId: string;
  onSwitchSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  isReconnecting?: boolean;
  // Room props
  rooms: Record<string, RoomSession>;
  onSelectRoom: (roomId: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  myId,
  chats,
  activeConnections,
  onSelectPeer,
  onConnect,
  onRenameChat,
  onShowDashboard,
  peerError,
  isReady,
  onRetry,
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateNewSession,
  onDeleteSession,
  isReconnecting,
  rooms,
  onSelectRoom,
}) => {
  // Get UI state from store
  const {
    viewMode,
    setViewMode,
    selectedPeerId,
    setShowSettings,
    activeRoomId,
    setShowCreateRoomModal,
    setShowJoinRoomModal,
  } = useAppStore();

  const [newPeerId, setNewPeerId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyInviteLink = () => {
    const url = createInviteLink(myId);
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Chat Renaming state
  const [renamingPeerId, setRenamingPeerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPeerId && newPeerId !== myId) {
      onConnect(newPeerId);
      setNewPeerId("");
      setIsAdding(false);
    }
  };

  const startRenaming = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setRenamingPeerId(chat.peerId);
    setRenameValue(chat.name || chat.peerId);
  };

  const saveRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (renamingPeerId) {
      onRenameChat(renamingPeerId, renameValue);
      setRenamingPeerId(null);
    }
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingPeerId(null);
  };

  const sortedChats = (Object.values(chats) as ChatSession[]).sort(
    (a, b) => b.lastUpdated - a.lastUpdated
  );

  const sortedRooms = (Object.values(rooms) as RoomSession[]).sort(
    (a, b) => b.lastUpdated - a.lastUpdated
  );

  return (
    <div className="w-full h-full bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Header / My Profile */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary-500" />
            Ping
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onShowDashboard}
              className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title="View Dashboard"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title="Connection Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <a
              href="https://github.com/HoangTran0410/chat-p2p"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title="GitHub Repo"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Session Switcher with ID display */}
        <SessionSwitcher
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={onSwitchSession}
          onCreateNewSession={onCreateNewSession}
          onDeleteSession={onDeleteSession}
          isReady={isReady}
          peerError={peerError}
          onRetry={onRetry}
          isReconnecting={isReconnecting}
        />
        {peerError && (
          <div className="mt-2 text-xs text-red-400 font-medium px-1">
            {peerError}
          </div>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setViewMode("chats")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "chats"
              ? "text-white border-b-2 border-primary-500 bg-slate-800/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setViewMode("rooms")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "rooms"
              ? "text-white border-b-2 border-purple-500 bg-slate-800/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Rooms
        </button>
      </div>

      {/* Chats content - only visible when viewMode is chats */}
      {viewMode === "chats" && (
        <>
          {/* New Chat Button */}
          <div className="p-4">
            {!isAdding ? (
              <div className="flex gap-2">
                <button
                  onClick={handleCopyInviteLink}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all font-medium ${
                    linkCopied
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Invite
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all font-medium shadow-lg shadow-primary-900/20"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleConnectSubmit}
                className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <input
                  type="text"
                  value={newPeerId}
                  onChange={(e) => setNewPeerId(e.target.value)}
                  placeholder="Enter Peer ID..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-1.5 rounded text-sm font-medium"
                  >
                    Connect
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {/* <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chats
            </div> */}

            {sortedChats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No chats yet.</p>
                <p className="mt-2 text-xs opacity-60">
                  Share your ID or enter a friend's ID to start.
                </p>
              </div>
            ) : (
              <ul className="space-y-1 px-2">
                {sortedChats.map((chat) => {
                  const isConnected = activeConnections.includes(chat.peerId);
                  const isActive = selectedPeerId === chat.peerId;
                  const lastMessage = chat.messages[chat.messages.length - 1];
                  const isRenaming = renamingPeerId === chat.peerId;

                  return (
                    <li key={chat.peerId}>
                      <div
                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 relative group ${
                          isActive
                            ? "bg-slate-800 border border-slate-700 shadow-sm"
                            : "hover:bg-slate-800/50 border border-transparent"
                        }`}
                      >
                        {/* Avatar */}
                        <button
                          onClick={() => onSelectPeer(chat.peerId)}
                          className="relative shrink-0"
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              isActive
                                ? "bg-primary-600 text-white"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {(chat.name || chat.peerId)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          {isConnected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                          )}
                        </button>

                        {/* Content */}
                        <div
                          className="flex-1 min-w-0"
                          onClick={() =>
                            !isRenaming && onSelectPeer(chat.peerId)
                          }
                        >
                          {isRenaming ? (
                            <form
                              onSubmit={saveRename}
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => saveRename()}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") cancelRename();
                                }}
                                className="w-full bg-slate-950 border border-primary-500/50 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
                              />
                            </form>
                          ) : (
                            <>
                              <div className="flex justify-between items-baseline mb-0.5">
                                <span
                                  className={`font-medium text-slate-200 truncate text-sm cursor-pointer ${
                                    !chat.name ? "font-mono" : ""
                                  }`}
                                >
                                  {chat.name || chat.peerId}
                                </span>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <button
                                    onClick={(e) => startRenaming(e, chat)}
                                    className="hidden md:block text-slate-500 hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Rename Contact"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>

                                  {lastMessage && (
                                    <span className="text-[10px] text-slate-500">
                                      {formatDistanceToNow(
                                        lastMessage.timestamp,
                                        {
                                          addSuffix: false,
                                        }
                                      ).replace("about ", "")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 truncate h-4 cursor-pointer">
                                {lastMessage ? (
                                  lastMessage.content
                                ) : (
                                  <span className="italic opacity-50">
                                    No messages
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Rooms content - only visible when viewMode is rooms */}
      {viewMode === "rooms" && (
        <>
          {/* Room Actions */}
          <div className="p-4 flex gap-2">
            <button
              onClick={() => setShowJoinRoomModal(true)}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-all font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Join
            </button>
            <button
              onClick={() => setShowCreateRoomModal(true)}
              className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all font-medium shadow-lg shadow-purple-900/20"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto">
            {/* <div className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rooms
            </div> */}

            {sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No rooms yet.</p>
                <p className="mt-2 text-xs opacity-60">
                  Create or join a room to chat with multiple people.
                </p>
              </div>
            ) : (
              <ul className="space-y-1 px-2">
                {sortedRooms.map((room) => {
                  const isActive = activeRoomId === room.roomId;
                  const isHost = room.hostId === myId;
                  const onlineCount = room.members.filter(
                    (m) => m.isOnline
                  ).length;
                  const lastMessage = room.messages[room.messages.length - 1];

                  return (
                    <li key={room.roomId}>
                      <button
                        onClick={() => onSelectRoom(room.roomId)}
                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                          isActive
                            ? "bg-slate-800 border border-slate-700 shadow-sm"
                            : "hover:bg-slate-800/50 border border-transparent"
                        }`}
                      >
                        {/* Room Avatar */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                              isActive
                                ? "bg-purple-600 text-white"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            <Users className="w-5 h-5" />
                          </div>
                          {isHost && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
                              <Crown className="w-2.5 h-2.5 text-slate-900" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="font-medium text-slate-200 truncate text-sm">
                              {room.name}
                            </span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                {onlineCount}
                              </span>
                              {lastMessage && (
                                <span className="text-[10px] text-slate-500">
                                  {formatDistanceToNow(lastMessage.timestamp, {
                                    addSuffix: false,
                                  }).replace("about ", "")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 truncate h-4">
                            {lastMessage ? (
                              <>
                                <span className="font-medium text-slate-500">
                                  {lastMessage.senderId === myId
                                    ? "You"
                                    : room.members.find(
                                        (m) => m.peerId === lastMessage.senderId
                                      )?.name ||
                                      lastMessage.senderId.slice(0, 6)}
                                  :
                                </span>{" "}
                                {lastMessage.content}
                              </>
                            ) : (
                              <span className="italic opacity-50">
                                No messages yet
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
