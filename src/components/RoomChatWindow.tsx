import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  ChevronLeft,
  Users,
  Crown,
  Copy,
  Check,
  Share2,
  X,
  LogOut,
  UserMinus,
} from "lucide-react";
import { RoomSession, RoomMember } from "../groupTypes";
import { Message } from "../types";
import { format } from "date-fns";

interface RoomChatWindowProps {
  myId: string;
  room: RoomSession;
  onSendMessage: (roomId: string, content: string) => void;
  onLeaveRoom: (roomId: string) => void;
  onBack: () => void;
  isHost: boolean;
}

export const RoomChatWindow: React.FC<RoomChatWindowProps> = ({
  myId,
  room,
  onSendMessage,
  onLeaveRoom,
  onBack,
  isHost,
}) => {
  const [inputText, setInputText] = useState("");
  const [showMemberList, setShowMemberList] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [room.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(room.roomId, inputText.trim());
      setInputText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}#room=${room.roomId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const onlineCount = room.members.filter((m) => m.isOnline).length;
  const getMemberName = (peerId: string): string => {
    if (peerId === myId) return "You";
    const member = room.members.find((m) => m.peerId === peerId);
    return member?.name || peerId.slice(0, 8);
  };

  return (
    <div className="flex-1 flex h-full bg-slate-950">
      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          showMemberList ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              {isHost && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 border-2 border-slate-950 rounded-full flex items-center justify-center">
                  <Crown className="w-2.5 h-2.5 text-slate-900" />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <h2 className="font-semibold text-slate-100 truncate text-base">
                {room.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  {onlineCount}
                </span>
                <span className="text-slate-600">/</span>
                <span>{room.members.length}</span>
                {isHost && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-yellow-500 flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Host
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Share Invite Link"
            >
              {linkCopied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => setShowMemberList(!showMemberList)}
              className={`p-2 rounded-lg transition-colors ${
                showMemberList
                  ? "text-purple-400 bg-purple-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Members"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={() => onLeaveRoom(room.roomId)}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title={isHost ? "Close Room" : "Leave Room"}
            >
              <LogOut className="w-4 h-4" />
            </button>

            <button
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden md:block"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {room.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm p-4 text-center">
              <Users className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-slate-400 mb-2">
                {isHost
                  ? "Room created! Share the invite link to add members."
                  : "Welcome to the room!"}
              </p>
              <p className="text-xs">
                Start the conversation by sending a message.
              </p>
            </div>
          ) : (
            room.messages.map((msg, index) => {
              const isMe = msg.senderId === myId;
              const senderName = getMemberName(msg.senderId);
              const showSender =
                !isMe &&
                (index === 0 ||
                  room.messages[index - 1].senderId !== msg.senderId ||
                  msg.timestamp - room.messages[index - 1].timestamp > 60000);

              // Group timestamp every 5 minutes
              const showTimestamp =
                index === 0 ||
                msg.timestamp - room.messages[index - 1].timestamp > 300000;

              return (
                <div key={msg.id} className="space-y-1">
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
                    {showSender && (
                      <span className="text-xs text-slate-500 mb-1 ml-1 flex items-center gap-1">
                        {senderName}
                        {room.members.find((m) => m.peerId === msg.senderId)
                          ?.isHost && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                        isMe
                          ? "bg-purple-600 text-white rounded-br-sm"
                          : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                      <div
                        className={`text-[10px] mt-1 ${
                          isMe ? "text-purple-200" : "text-slate-500"
                        }`}
                      >
                        {format(msg.timestamp, "h:mm a")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 p-2 rounded-xl border border-slate-700 bg-slate-900 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all"
          >
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none py-2.5 px-2 max-h-32 text-sm outline-none"
              rows={1}
              style={{ minHeight: "44px" }}
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`p-2.5 rounded-lg mb-0.5 transition-all ${
                inputText.trim()
                  ? "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Member List Panel */}
      {showMemberList && (
        <div className="w-full md:w-72 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Members ({room.members.length})
            </h3>
            <button
              onClick={() => setShowMemberList(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Member List */}
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {room.members
                .sort((a, b) => a.priority - b.priority)
                .map((member) => {
                  const isCurrentUser = member.peerId === myId;

                  return (
                    <li
                      key={member.peerId}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        isCurrentUser ? "bg-slate-800/50" : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            member.isHost
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {(member.name || member.peerId)
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            member.isOnline ? "bg-green-500" : "bg-slate-600"
                          }`}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm truncate ${
                              isCurrentUser
                                ? "text-slate-200 font-medium"
                                : "text-slate-300"
                            }`}
                          >
                            {member.name || member.peerId.slice(0, 8)}
                            {isCurrentUser && (
                              <span className="text-slate-500"> (you)</span>
                            )}
                          </span>
                          {member.isHost && (
                            <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {member.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>

          {/* Invite Button */}
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={handleCopyLink}
              className="w-full py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {linkCopied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {linkCopied ? "Link Copied!" : "Copy Invite Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
