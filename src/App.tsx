import React, { useState, useEffect, useCallback } from "react";
import { useP2P } from "./hooks/useP2P";
import {
  getStoredChats,
  saveChatSession,
  generateId,
} from "./services/storage";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { ChatSession, Message } from "./types";
import { X } from "lucide-react";

export default function App() {
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [showMobileDashboard, setShowMobileDashboard] = useState(false);
  const [typingStates, setTypingStates] = useState<Record<string, boolean>>({});

  // Load initial chats
  useEffect(() => {
    setChats(getStoredChats());
  }, []);

  const handleMessageReceived = useCallback(
    (peerId: string, data: any) => {
      // Handle Typing Events
      if (data && typeof data === "object" && data.type === "typing") {
        setTypingStates((prev) => ({
          ...prev,
          [peerId]: data.isTyping,
        }));
        return;
      }

      // Handle Presence - peer is online (no action needed, connection status handles it)
      if (data && typeof data === "object" && data.type === "presence") {
        return;
      }

      // Handle Standard Messages
      // We expect data to be just the string content or an object with content
      const content = typeof data === "string" ? data : data.content;
      if (!content) return;

      // If we receive a message, they clearly stopped typing (or sent it)
      setTypingStates((prev) => ({ ...prev, [peerId]: false }));

      const newMessage: Message = {
        id: generateId(),
        senderId: peerId,
        content: content,
        timestamp: Date.now(),
      };

      setChats((prev) => {
        const currentSession = prev[peerId] || {
          peerId,
          messages: [],
          lastUpdated: Date.now(),
          unreadCount: 0,
        };

        const updatedSession = {
          ...currentSession,
          messages: [...currentSession.messages, newMessage],
          lastUpdated: Date.now(),
          unreadCount:
            selectedPeerId === peerId ? 0 : currentSession.unreadCount + 1,
        };

        const newChats = { ...prev, [peerId]: updatedSession };
        saveChatSession(peerId, updatedSession);
        return newChats;
      });
    },
    [selectedPeerId]
  );

  const handleConnectionOpened = useCallback((peerId: string) => {
    // If we don't have a chat session for this peer, create one
    setChats((prev) => {
      if (!prev[peerId]) {
        const newSession: ChatSession = {
          peerId,
          messages: [],
          lastUpdated: Date.now(),
          unreadCount: 0,
        };
        saveChatSession(peerId, newSession);
        return { ...prev, [peerId]: newSession };
      }
      return prev;
    });

    if (window.innerWidth >= 768) {
      setSelectedPeerId((prev) => (prev ? prev : peerId));
    }
  }, []);

  const handleConnectionClosed = useCallback((peerId: string) => {
    // State is updated automatically via useP2P connectionStates
    setTypingStates((prev) => ({ ...prev, [peerId]: false }));
  }, []);

  const {
    myId,
    activeConnectionsCount,
    connectToPeer,
    disconnectPeer,
    sendMessage,
    updateId,
    peerError,
    connectionError,
    resetConnectionError,
    isReady,
    connectionStates,
  } = useP2P({
    onMessageReceived: handleMessageReceived,
    onConnectionOpened: handleConnectionOpened,
    onConnectionClosed: handleConnectionClosed,
  });

  const handleSendMessage = (content: string) => {
    if (!selectedPeerId) return;

    // Send standard message object
    const success = sendMessage(selectedPeerId, { content });

    if (success) {
      const newMessage: Message = {
        id: generateId(),
        senderId: myId,
        content,
        timestamp: Date.now(),
      };

      setChats((prev) => {
        const currentSession = prev[selectedPeerId] || {
          peerId: selectedPeerId,
          messages: [],
          lastUpdated: Date.now(),
          unreadCount: 0,
        };

        const updatedSession = {
          ...currentSession,
          messages: [...currentSession.messages, newMessage],
          lastUpdated: Date.now(),
        };

        const newChats = { ...prev, [selectedPeerId]: updatedSession };
        saveChatSession(selectedPeerId, updatedSession);
        return newChats;
      });
    } else {
      alert("Failed to send. Peer might be disconnected.");
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (selectedPeerId) {
      sendMessage(selectedPeerId, { type: "typing", isTyping });
    }
  };

  const handleConnect = (peerId: string) => {
    connectToPeer(peerId);
    setSelectedPeerId(peerId);
    setShowMobileDashboard(false);
  };

  const handleDeleteChat = () => {
    if (!selectedPeerId) return;

    if (confirm("Are you sure you want to delete this conversation?")) {
      disconnectPeer(selectedPeerId);
      setChats((prev) => {
        const newChats = { ...prev };
        delete newChats[selectedPeerId];
        const allChats = getStoredChats();
        delete allChats[selectedPeerId];
        localStorage.setItem("synapse_chats", JSON.stringify(allChats));
        return newChats;
      });
      setSelectedPeerId(null);
    }
  };

  const handleRenameChat = (peerId: string, newName: string) => {
    setChats((prev) => {
      const chat = prev[peerId];
      if (!chat) return prev;

      const updatedChat = {
        ...chat,
        name: newName.trim() === "" ? undefined : newName.trim(),
      };

      saveChatSession(peerId, updatedChat);
      return { ...prev, [peerId]: updatedChat };
    });
  };

  const handleBackToSidebar = () => {
    setSelectedPeerId(null);
    setShowMobileDashboard(false);
  };

  const activeConnectionIds = Object.keys(connectionStates).filter(
    (id) => connectionStates[id] === "connected"
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary-500/30 relative">
      {/* Toast Notification for Connection Errors */}
      {connectionError && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-red-500/10 border border-red-500/50 backdrop-blur-md text-red-200 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <span className="text-sm font-medium">{connectionError}</span>
            <button
              onClick={resetConnectionError}
              className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar - Hidden on mobile if chat or dashboard is open */}
      <div
        className={`
        ${selectedPeerId || showMobileDashboard ? "hidden md:flex" : "flex"}
        w-full md:w-80 flex-col border-r border-slate-800
      `}
      >
        <ChatSidebar
          myId={myId}
          chats={chats}
          activeConnections={activeConnectionIds}
          selectedPeerId={selectedPeerId}
          onSelectPeer={(id) => {
            setSelectedPeerId(id);
            setShowMobileDashboard(false);
            // Auto-reconnect if not connected
            if (connectionStates[id] !== "connected") {
              connectToPeer(id);
            }
          }}
          onConnect={handleConnect}
          onUpdateId={updateId}
          onRenameChat={handleRenameChat}
          onShowDashboard={() => setShowMobileDashboard(true)}
          peerError={peerError}
          isReady={isReady}
          onRetry={() => updateId(myId)}
          onRandomId={() => updateId(generateId())}
        />
      </div>

      {/* Main Window - Visible on mobile if chat or dashboard is open */}
      <div
        className={`
        ${selectedPeerId || showMobileDashboard ? "flex" : "hidden md:flex"}
        flex-1 flex-col min-w-0 bg-slate-950
      `}
      >
        <ChatWindow
          myId={myId}
          peerId={selectedPeerId || ""}
          session={selectedPeerId ? chats[selectedPeerId] : undefined}
          connectionState={
            selectedPeerId
              ? connectionStates[selectedPeerId] || "disconnected"
              : "disconnected"
          }
          onSendMessage={handleSendMessage}
          onDeleteChat={handleDeleteChat}
          onBack={handleBackToSidebar}
          onConnect={() => selectedPeerId && handleConnect(selectedPeerId)}
          onCancelConnection={() =>
            selectedPeerId && disconnectPeer(selectedPeerId)
          }
          isReady={isReady}
          activeConnectionsCount={activeConnectionsCount}
          totalChats={Object.keys(chats).length}
          isPeerTyping={selectedPeerId ? typingStates[selectedPeerId] : false}
          onTyping={handleTyping}
          peerError={peerError}
          onRetry={() => updateId(myId)}
          onRandomId={() => updateId(generateId())}
          onUpdateId={updateId}
        />
      </div>
    </div>
  );
}
