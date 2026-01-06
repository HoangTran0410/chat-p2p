import React, { useState, useEffect, useCallback, useRef } from "react";
import { useP2P } from "./hooks/useP2P";
import { useEncryption } from "./hooks/useEncryption";
import {
  generateId,
  getStoredSessions,
  storeSession,
  deleteSession as deleteStoredSession,
  getActiveSessionId,
  setActiveSessionId,
  clearStorage,
} from "./services/storage";
import {
  initDB,
  getAllChatsFromDB,
  saveChatToDB,
  deleteChatFromDB,
  deleteAllChatsForSession,
  clearDB,
} from "./services/db";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { SettingsModal } from "./components/SettingsModal";
import { SyncModal } from "./components/SyncModal";
import { NewSessionDialog } from "./components/NewSessionDialog";
import { KeyChangeWarningModal } from "./components/KeyChangeWarningModal";
import {
  ChatSession,
  Message,
  PeerConfig,
  FILE_CHUNK_SIZE,
  FileTransfer,
  MessageType,
  UserSession,
  EncryptedPayload,
} from "./types";
import { X, RefreshCw } from "lucide-react";
import { DEFAULT_PEER_CONFIG, MAX_CONNECTIONS } from "./constants";

export default function App() {
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [showMobileDashboard, setShowMobileDashboard] = useState(false);
  const [typingStates, setTypingStates] = useState<Record<string, boolean>>({});

  // Session management state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string>("");
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [peerConfig, setPeerConfig] = useState<PeerConfig>(() => {
    const saved = localStorage.getItem("peer_config");
    return saved ? JSON.parse(saved) : DEFAULT_PEER_CONFIG;
  });

  // Sync state
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "outgoing" | "incoming"
  >("idle");
  const [syncTargetPeerId, setSyncTargetPeerId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    phase: string;
    count: number;
  } | null>(null);

  // Connection limit warning
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // E2EE state
  const [keyChangeWarning, setKeyChangeWarning] = useState<{
    peerId: string;
    oldFingerprint: string;
    newFingerprint: string;
  } | null>(null);

  // Auto-connect from URL hash
  const [pendingConnectPeerId, setPendingConnectPeerId] = useState<
    string | null
  >(() => {
    // Check URL hash for peer ID to connect to (format: #connect=PEER_ID)
    const hash = window.location.hash;
    if (hash.startsWith("#connect=")) {
      const peerId = hash.slice(9); // Remove "#connect="
      // Clear the hash from URL
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      return peerId;
    }
    return null;
  });

  // Chunked file transfer state
  const [sendingProgress, setSendingProgress] = useState<{
    fileId: string;
    progress: number;
  } | null>(null);
  const [receivingProgress, setReceivingProgress] = useState<{
    fileId: string;
    fileName: string;
    progress: number;
  } | null>(null);
  const activeTransfersRef = useRef<Map<string, FileTransfer>>(new Map());

  // Ref to track current session ID for use in callbacks
  const activeSessionIdRef = useRef<string>("");
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Ref for sendMessage to avoid circular dependency
  const sendMessageRef = useRef<(peerId: string, data: any) => boolean>(
    () => false
  );

  // Refs for E2EE functions (needed before useEncryption is called)
  const handleKeyExchangeRef = useRef<
    (peerId: string, payload: any) => Promise<boolean>
  >(async () => false);
  const createKeyExchangeRef = useRef<() => Promise<any>>(async () => null);
  const handleMessageReceivedRef = useRef<(peerId: string, data: any) => void>(
    () => {}
  );
  const hasPeerKeyRef = useRef<(peerId: string) => boolean>(() => false);

  // Load initial sessions and chats
  useEffect(() => {
    const init = async () => {
      try {
        await initDB();

        // Load sessions
        let storedSessions = getStoredSessions();
        let currentSessionId = getActiveSessionId();

        // If no sessions exist, create initial session
        if (storedSessions.length === 0) {
          const initialId = generateId();
          const initialSession: UserSession = {
            id: initialId,
            createdAt: Date.now(),
          };
          storeSession(initialSession);
          setActiveSessionId(initialId);
          storedSessions = [initialSession];
          currentSessionId = initialId;
        } else if (
          !currentSessionId ||
          !storedSessions.find((s) => s.id === currentSessionId)
        ) {
          // If no active session or active session doesn't exist, use first
          currentSessionId = storedSessions[0].id;
          setActiveSessionId(currentSessionId);
        }

        setSessions(storedSessions);
        setActiveSessionIdState(currentSessionId);

        // Load chats for the active session
        const storedChats = await getAllChatsFromDB(currentSessionId);
        setChats(storedChats);
      } catch (e) {
        console.error("Failed to init storage:", e);
      } finally {
        setIsStorageReady(true);
      }
    };
    init();
  }, []);

  const handleSaveConfig = (config: PeerConfig) => {
    setPeerConfig(config);
    localStorage.setItem("peer_config", JSON.stringify(config));
    // useP2P will auto-reconnect due to dependency change
  };

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

      // Handle Key Exchange (E2EE)
      if (data && typeof data === "object" && data.type === "key_exchange") {
        // Check if we already have a key with this peer (to prevent infinite loop)
        const alreadyHaveKey = hasPeerKeyRef.current(peerId);

        handleKeyExchangeRef.current(peerId, data).then((success) => {
          if (success) {
            console.log("Key exchange completed with", peerId);
            // Only send our key exchange back if we didn't have one before
            // This prevents infinite ping-pong
            if (!alreadyHaveKey) {
              createKeyExchangeRef.current().then((payload) => {
                if (payload) {
                  sendMessageRef.current(peerId, {
                    type: "key_exchange",
                    ...payload,
                  });
                }
              });
            }
          }
        });
        return;
      }

      // Handle Encrypted Messages
      if (
        data &&
        typeof data === "object" &&
        data.type === "encrypted_message"
      ) {
        decryptRef
          .current(peerId, data.payload as EncryptedPayload)
          .then((plaintext) => {
            if (plaintext) {
              try {
                const decryptedData = JSON.parse(plaintext);
                // Recursively handle the decrypted message
                handleMessageReceivedRef.current(peerId, {
                  ...decryptedData,
                  _encrypted: true,
                });
              } catch {
                console.error("Failed to parse decrypted message");
              }
            }
          });
        return;
      }

      // Handle Delivery/Read Receipts
      if (data && typeof data === "object" && data.type === "receipt") {
        const { messageId, status, timestamp } = data;
        setChats((prev) => {
          const session = prev[peerId];
          if (!session) return prev;

          const updatedMessages = session.messages.map((msg) => {
            if (msg.id === messageId) {
              if (status === "delivered") {
                return {
                  ...msg,
                  status: "delivered" as const,
                  receivedAt: timestamp,
                };
              } else if (status === "read") {
                return { ...msg, status: "read" as const, readAt: timestamp };
              }
            }
            return msg;
          });

          const updatedSession = { ...session, messages: updatedMessages };
          saveChatToDB(activeSessionIdRef.current, updatedSession);
          return { ...prev, [peerId]: updatedSession };
        });
        return;
      }

      // Handle File Transfer - Start
      if (data && typeof data === "object" && data.type === "file_start") {
        const {
          fileId,
          fileName,
          fileSize,
          mimeType,
          totalChunks,
          messageType,
        } = data;
        const transfer: FileTransfer = {
          id: fileId,
          fileName,
          fileSize,
          mimeType,
          totalChunks,
          receivedChunks: new Map(),
          progress: 0,
          messageType: messageType || "file",
        };
        activeTransfersRef.current.set(fileId, transfer);
        setReceivingProgress({ fileId, fileName, progress: 0 });
        return;
      }

      // Handle File Transfer - Chunk
      if (data && typeof data === "object" && data.type === "file_chunk") {
        const { fileId, chunkIndex, data: chunkData } = data;
        const transfer = activeTransfersRef.current.get(fileId);
        if (!transfer) return;

        transfer.receivedChunks.set(chunkIndex, chunkData);
        const progress = Math.round(
          (transfer.receivedChunks.size / transfer.totalChunks) * 100
        );
        transfer.progress = progress;
        setReceivingProgress({ fileId, fileName: transfer.fileName, progress });
        return;
      }

      // Handle File Transfer - End
      if (data && typeof data === "object" && data.type === "file_end") {
        const { fileId } = data;
        const transfer = activeTransfersRef.current.get(fileId);
        if (!transfer) return;

        // Reassemble chunks
        const chunks: ArrayBuffer[] = [];
        for (let i = 0; i < transfer.totalChunks; i++) {
          const chunk = transfer.receivedChunks.get(i);
          if (chunk) chunks.push(chunk);
        }
        const completeData = new Blob(chunks);

        // Create message
        const newMessage: Message = {
          id: generateId(),
          senderId: peerId,
          content: transfer.fileName,
          timestamp: Date.now(),
          receivedAt: Date.now(),
          status: "delivered",
          type: transfer.messageType,
          file: {
            name: transfer.fileName,
            size: transfer.fileSize,
            mimeType: transfer.mimeType,
            data: completeData,
          },
        };

        // Add to chat
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
          saveChatToDB(activeSessionIdRef.current, updatedSession);
          return { ...prev, [peerId]: updatedSession };
        });

        // Send delivery receipt
        sendMessageRef.current(peerId, {
          type: "receipt",
          messageId: newMessage.id,
          status: "delivered",
          timestamp: Date.now(),
        });

        // Cleanup
        activeTransfersRef.current.delete(fileId);
        setReceivingProgress(null);
        return;
      }

      // Handle Sync Request (Peer asks for history)
      if (data && typeof data === "object" && data.type === "sync_request") {
        setSyncStatus("incoming");
        setSyncTargetPeerId(peerId);
        return;
      }

      // Handle Sync Reject
      if (data && typeof data === "object" && data.type === "sync_reject") {
        setSyncStatus("idle");
        setSyncTargetPeerId(null);
        alert(`${peerId} declined the sync request.`);
        return;
      }

      // Handle Sync Cancel
      if (data && typeof data === "object" && data.type === "sync_cancel") {
        setSyncStatus("idle");
        setSyncTargetPeerId(null);
        return;
      }

      // Handle Sync Data (Initial or Final)
      if (
        data &&
        typeof data === "object" &&
        (data.type === "sync_data_initial" || data.type === "sync_data_final")
      ) {
        const incomingMessages = data.messages as Message[];
        if (!Array.isArray(incomingMessages)) return;

        setChats((prev) => {
          const session = prev[peerId] || {
            peerId,
            messages: [],
            lastUpdated: Date.now(),
            unreadCount: 0,
          };

          const existingIds = new Set(session.messages.map((m) => m.id));
          const newMessages = incomingMessages.filter(
            (m) => !existingIds.has(m.id)
          );

          if (newMessages.length === 0 && data.type === "sync_data_final") {
            return prev;
          }

          const mergedMessages = [...session.messages, ...newMessages].sort(
            (a, b) => a.timestamp - b.timestamp
          );

          const updatedSession = { ...session, messages: mergedMessages };
          saveChatToDB(activeSessionIdRef.current, updatedSession);

          // If this was initial data, send back my merged full history (Final Step)
          if (data.type === "sync_data_initial") {
            sendMessageRef.current(peerId, {
              type: "sync_data_final",
              messages: mergedMessages,
            });
          }

          return { ...prev, [peerId]: updatedSession };
        });

        // Reset status if we are the initiator (receiving initial data) or receiver (receiving final data)
        // Actually, logic is:
        // Initiator sends Request -> idle (waiting)
        // Receiver gets Request -> Incoming Modal -> Accept -> Sends Initial Data -> idle
        // Initiator gets Initial Data -> Merges -> Sends Final Data -> Idle
        // Receiver gets Final Data -> Merges -> Idle

        // So we can assume if we processed data successfully, we can clear modal states (though they should be cleared already for Receiver)
        // Update sync progress
        setSyncProgress({
          phase: data.type === "sync_data_initial" ? "Receiving" : "Merging",
          count: incomingMessages.length,
        });

        // Reset status
        setTimeout(() => {
          setSyncStatus("idle");
          setSyncTargetPeerId(null);
          setSyncProgress(null);
        }, 500);
        return;
      }

      // Handle Standard Messages
      // Handle Standard Messages
      const messageId = data.id || generateId();
      const sentTimestamp = data.timestamp || Date.now();
      const wasEncrypted = data._encrypted === true;

      let newMessage: Message;
      if (typeof data === "string") {
        newMessage = {
          id: messageId,
          senderId: peerId,
          content: data,
          timestamp: sentTimestamp,
          receivedAt: Date.now(),
          status: "delivered",
          type: "text",
          encrypted: false,
        };
      } else {
        newMessage = {
          id: messageId,
          senderId: peerId,
          content: data.content || "",
          timestamp: sentTimestamp,
          receivedAt: Date.now(),
          status: "delivered",
          type: data.type || "text",
          file: data.file,
          encrypted: wasEncrypted,
        };
      }

      if (!newMessage.content && !newMessage.file) return;

      // Send delivery receipt back
      sendMessageRef.current(peerId, {
        type: "receipt",
        messageId: messageId,
        status: "delivered",
        timestamp: Date.now(),
      });

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
        saveChatToDB(activeSessionIdRef.current, updatedSession);
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
        saveChatToDB(activeSessionIdRef.current, newSession);
        return { ...prev, [peerId]: newSession };
      }
      return prev;
    });

    // Initiate E2EE key exchange
    createKeyExchangeRef.current().then((payload) => {
      if (payload) {
        sendMessageRef.current(peerId, { type: "key_exchange", ...payload });
      }
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
    isReconnecting,
  } = useP2P({
    config: peerConfig,
    sessionId: activeSessionId,
    onMessageReceived: handleMessageReceived,
    onConnectionOpened: handleConnectionOpened,
    onConnectionClosed: handleConnectionClosed,
    onConnectionLimitExceeded: (disconnectedPeerId) => {
      const name =
        chats[disconnectedPeerId]?.name || disconnectedPeerId.slice(0, 8);
      setLimitWarning(
        `Disconnected "${name}" - max ${MAX_CONNECTIONS} connections reached`
      );
      setTimeout(() => setLimitWarning(null), 4000);
    },
  });

  // E2EE Hook
  const {
    isReady: isEncryptionReady,
    myFingerprint,
    myShortFingerprint,
    createKeyExchange,
    handleKeyExchange,
    encrypt,
    decrypt,
    getPeerFingerprint,
    hasPeerKey,
    markPeerVerified,
    exportMyKeys,
    importMyKeys,
    peerStates: encryptionPeerStates,
  } = useEncryption({
    sessionId: activeSessionId,
    onKeyChange: (peerId, oldFp, newFp) => {
      setKeyChangeWarning({
        peerId,
        oldFingerprint: oldFp,
        newFingerprint: newFp,
      });
    },
  });

  // Ref for encryption functions
  const encryptRef = useRef(encrypt);
  const decryptRef = useRef(decrypt);
  useEffect(() => {
    encryptRef.current = encrypt;
    decryptRef.current = decrypt;
    handleKeyExchangeRef.current = handleKeyExchange;
    createKeyExchangeRef.current = createKeyExchange;
    hasPeerKeyRef.current = hasPeerKey;
  }, [encrypt, decrypt, handleKeyExchange, createKeyExchange, hasPeerKey]);

  // Update ref when sendMessage is available
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Update handleMessageReceived ref
  useEffect(() => {
    handleMessageReceivedRef.current = handleMessageReceived;
  }, [handleMessageReceived]);

  // Auto-connect from URL hash when ready
  useEffect(() => {
    if (isReady && pendingConnectPeerId && pendingConnectPeerId !== myId) {
      console.log("Auto-connecting to peer from URL:", pendingConnectPeerId);
      connectToPeer(pendingConnectPeerId);
      setSelectedPeerId(pendingConnectPeerId);
      setPendingConnectPeerId(null);
    }
  }, [isReady, pendingConnectPeerId, myId, connectToPeer]);

  const handleSendMessage = async (contentOrMsg: string | Partial<Message>) => {
    if (!selectedPeerId) return;

    const messageId = generateId();
    const timestamp = Date.now();

    let messageData: any = {
      id: messageId,
      timestamp,
    };

    if (typeof contentOrMsg === "string") {
      messageData.content = contentOrMsg;
      messageData.type = "text";
    } else {
      messageData = { ...messageData, ...contentOrMsg };
    }

    // Check if we have E2EE with this peer
    const canEncrypt = hasPeerKey(selectedPeerId);
    let success = false;
    let isEncrypted = false;

    if (canEncrypt) {
      // Encrypt the message
      const encrypted = await encrypt(
        selectedPeerId,
        JSON.stringify(messageData)
      );
      if (encrypted) {
        success = sendMessage(selectedPeerId, {
          type: "encrypted_message",
          payload: encrypted,
        });
        isEncrypted = true;
      } else {
        // Fallback to unencrypted if encryption fails
        success = sendMessage(selectedPeerId, messageData);
      }
    } else {
      // Send unencrypted (no key exchange yet)
      success = sendMessage(selectedPeerId, messageData);
    }

    if (success) {
      const newMessage: Message = {
        id: messageId,
        senderId: myId,
        content: messageData.content || "",
        timestamp,
        status: "sent",
        type: messageData.type,
        file: messageData.file,
        encrypted: isEncrypted,
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
        saveChatToDB(activeSessionIdRef.current, updatedSession);
        return newChats;
      });

      // Set timeout to check for delivery
      setTimeout(() => {
        setChats((currentChats) => {
          const session = currentChats[selectedPeerId];
          if (!session) return currentChats;

          const msg = session.messages.find((m) => m.id === messageId);
          // If message is still just 'sent' (not delivered/read) after timeout, mark as failed
          if (msg && msg.status === "sent") {
            const updatedMessages = session.messages.map((m) =>
              m.id === messageId ? { ...m, status: "failed" as const } : m
            );

            const updatedSession = { ...session, messages: updatedMessages };
            saveChatToDB(activeSessionIdRef.current, updatedSession);
            return { ...currentChats, [selectedPeerId]: updatedSession };
          }

          return currentChats;
        });
      }, 10000); // 10 seconds timeout
    } else {
      // Save as failed message for retry
      const failedMessage: Message = {
        id: messageId,
        senderId: myId,
        content: messageData.content || "",
        timestamp,
        status: "failed",
        type: messageData.type,
        file: messageData.file,
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
          messages: [...currentSession.messages, failedMessage],
          lastUpdated: Date.now(),
        };

        const newChats = { ...prev, [selectedPeerId]: updatedSession };
        saveChatToDB(activeSessionIdRef.current, updatedSession);
        return newChats;
      });
    }
  };

  const handleSendFileChunked = async (
    fileId: string,
    file: File,
    messageType: "image" | "video" | "file"
  ) => {
    if (!selectedPeerId) return;

    const totalChunks = Math.ceil(file.size / FILE_CHUNK_SIZE);
    const arrayBuffer = await file.arrayBuffer();

    // Send file_start
    sendMessage(selectedPeerId, {
      type: "file_start",
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
      messageType,
    });

    // Add placeholder message to local chat
    const placeholderMessage: Message = {
      id: fileId,
      senderId: myId,
      content: file.name,
      timestamp: Date.now(),
      status: "sending",
      type: messageType,
      file: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        data: new Blob([arrayBuffer]),
      },
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
        messages: [...currentSession.messages, placeholderMessage],
        lastUpdated: Date.now(),
      };
      return { ...prev, [selectedPeerId]: updatedSession };
    });

    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * FILE_CHUNK_SIZE;
      const end = Math.min(start + FILE_CHUNK_SIZE, file.size);
      const chunkData = arrayBuffer.slice(start, end);

      sendMessage(selectedPeerId, {
        type: "file_chunk",
        fileId,
        chunkIndex: i,
        data: chunkData,
      });

      // Update progress
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      setSendingProgress({ fileId, progress });

      // Small delay to prevent overwhelming the connection
      await new Promise((r) => setTimeout(r, 10));
    }

    // Send file_end
    sendMessage(selectedPeerId, {
      type: "file_end",
      fileId,
    });

    // Update message status to sent
    setChats((prev) => {
      const session = prev[selectedPeerId];
      if (!session) return prev;
      const updatedMessages = session.messages.map((msg) =>
        msg.id === fileId ? { ...msg, status: "sent" as const } : msg
      );
      const updatedSession = { ...session, messages: updatedMessages };
      saveChatToDB(activeSessionIdRef.current, updatedSession);
      return { ...prev, [selectedPeerId]: updatedSession };
    });

    setSendingProgress(null);
  };

  const handleTyping = (isTyping: boolean) => {
    if (selectedPeerId) {
      sendMessage(selectedPeerId, { type: "typing", isTyping });
    }
  };

  const handleResendMessage = (messageId: string) => {
    if (!selectedPeerId) return;

    const session = chats[selectedPeerId];
    if (!session) return;

    const message = session.messages.find((m) => m.id === messageId);
    if (!message || message.status !== "failed") return;

    // Try to resend
    const success = sendMessage(selectedPeerId, {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    });

    if (success) {
      // Update status to sent
      setChats((prev) => {
        const currentSession = prev[selectedPeerId];
        if (!currentSession) return prev;

        const updatedMessages = currentSession.messages.map((msg) =>
          msg.id === messageId ? { ...msg, status: "sent" as const } : msg
        );

        const updatedSession = { ...currentSession, messages: updatedMessages };
        saveChatToDB(activeSessionIdRef.current, updatedSession);
        return { ...prev, [selectedPeerId]: updatedSession };
      });

      // Set timeout for resend verification
      setTimeout(() => {
        setChats((currentChats) => {
          const session = currentChats[selectedPeerId];
          if (!session) return currentChats;

          const msg = session.messages.find((m) => m.id === messageId);
          if (msg && msg.status === "sent") {
            const updatedMessages = session.messages.map((m) =>
              m.id === messageId ? { ...m, status: "failed" as const } : m
            );

            const updatedSession = { ...session, messages: updatedMessages };
            saveChatToDB(activeSessionIdRef.current, updatedSession);
            return { ...currentChats, [selectedPeerId]: updatedSession };
          }

          return currentChats;
        });
      }, 10000);
    }
  };

  const handleRequestSync = () => {
    if (!selectedPeerId) return;
    sendMessage(selectedPeerId, { type: "sync_request" });
    setSyncStatus("outgoing");
    setSyncTargetPeerId(selectedPeerId);
  };

  const handleCancelSync = () => {
    if (syncTargetPeerId) {
      sendMessage(syncTargetPeerId, { type: "sync_cancel" });
    }
    setSyncStatus("idle");
    setSyncTargetPeerId(null);
  };

  const handleAcceptSync = () => {
    if (!syncTargetPeerId) return;

    // Get messages to send
    const session = chats[syncTargetPeerId];
    const messages = session ? session.messages : [];

    // Show progress immediately
    setSyncStatus("outgoing");
    setSyncProgress({ phase: "Sending", count: messages.length });

    // Send my history (Initial Step)
    sendMessage(syncTargetPeerId, {
      type: "sync_data_initial",
      messages: messages,
    });

    // Close after a brief delay to show progress
    setTimeout(() => {
      setSyncStatus("idle");
      setSyncTargetPeerId(null);
      setSyncProgress(null);
    }, 800);
  };

  const handleRejectSync = () => {
    if (!syncTargetPeerId) return;
    sendMessage(syncTargetPeerId, { type: "sync_reject" });
    setSyncStatus("idle");
    setSyncTargetPeerId(null);
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
        deleteChatFromDB(activeSessionIdRef.current, selectedPeerId);
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

      saveChatToDB(activeSessionIdRef.current, updatedChat);
      return { ...prev, [peerId]: updatedChat };
    });
  };

  const handleBackToSidebar = () => {
    setSelectedPeerId(null);
    setShowMobileDashboard(false);
  };

  // Session Management Handlers
  const handleSwitchSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;

    // Clear current state
    setSelectedPeerId(null);
    setChats({});

    // Update active session
    setActiveSessionId(sessionId);
    setActiveSessionIdState(sessionId);

    // Load chats for new session
    try {
      const storedChats = await getAllChatsFromDB(sessionId);
      setChats(storedChats);
    } catch (e) {
      console.error("Failed to load chats for session:", e);
    }
  };

  const handleCreateNewSession = () => {
    setShowNewSessionDialog(true);
  };

  const handleConfirmNewSession = async () => {
    const newId = generateId();
    const newSession: UserSession = {
      id: newId,
      createdAt: Date.now(),
    };

    // Store new session
    storeSession(newSession);

    // Update state
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);

    // Switch to new session
    setActiveSessionId(newId);
    setActiveSessionIdState(newId);

    // Clear chats (new session has no chats)
    setChats({});
    setSelectedPeerId(null);

    // Close dialog
    setShowNewSessionDialog(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return; // Can't delete active session

    // Delete session from storage
    deleteStoredSession(sessionId);

    // Delete all chats for this session
    try {
      await deleteAllChatsForSession(sessionId);
    } catch (e) {
      console.error("Failed to delete chats for session:", e);
    }

    // Update state
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleClearData = async () => {
    try {
      // Clear IndexedDB
      await clearDB();
      // Clear LocalStorage
      clearStorage();
      // Reload page to reset state entirely
      window.location.reload();
    } catch (e) {
      console.error("Failed to clear data:", e);
      alert("Failed to clear data completely. Please try refreshing.");
    }
  };

  const activeConnectionIds = Object.keys(connectionStates).filter(
    (id) => connectionStates[id] === "connected"
  );

  // Show loading until storage is ready
  if (!isStorageReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        Initializing...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-primary-500/30 relative">
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

      {/* Connection Limit Warning Toast */}
      {limitWarning && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-yellow-500/10 border border-yellow-500/50 backdrop-blur-md text-yellow-200 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <span className="text-sm font-medium">{limitWarning}</span>
            <button
              onClick={() => setLimitWarning(null)}
              className="p-1 hover:bg-yellow-500/20 rounded-full transition-colors"
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
          onRenameChat={handleRenameChat}
          onShowDashboard={() => setShowMobileDashboard(true)}
          peerError={peerError}
          isReady={isReady}
          onRetry={() => updateId(myId)}
          onOpenSettings={() => setShowSettings(true)}
          // Session management props
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={handleSwitchSession}
          onCreateNewSession={handleCreateNewSession}
          onDeleteSession={handleDeleteSession}
          isReconnecting={isReconnecting}
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
          onRenameChat={(newName) =>
            selectedPeerId && handleRenameChat(selectedPeerId, newName)
          }
          onResendMessage={handleResendMessage}
          onRequestSync={handleRequestSync}
          onSendFileChunked={handleSendFileChunked}
          sendingProgress={sendingProgress}
          receivingProgress={receivingProgress}
          peerFingerprint={
            selectedPeerId ? getPeerFingerprint(selectedPeerId) : null
          }
          isEncrypted={selectedPeerId ? hasPeerKey(selectedPeerId) : false}
        />
      </div>

      {/* Sync Modal */}
      <SyncModal
        status={syncStatus}
        targetPeerId={syncTargetPeerId}
        peerName={syncTargetPeerId ? chats[syncTargetPeerId]?.name : undefined}
        progress={syncProgress}
        onCancel={handleCancelSync}
        onAccept={handleAcceptSync}
        onReject={handleRejectSync}
      />

      {/* New Session Dialog */}
      <NewSessionDialog
        isOpen={showNewSessionDialog}
        onClose={() => setShowNewSessionDialog(false)}
        onConfirm={handleConfirmNewSession}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          config={peerConfig}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
          onClearData={handleClearData}
          myFingerprint={myFingerprint}
          onExportKeys={exportMyKeys}
          onImportKeys={importMyKeys}
        />
      )}

      {/* Key Change Warning Modal */}
      <KeyChangeWarningModal
        warning={keyChangeWarning}
        peerName={
          keyChangeWarning ? chats[keyChangeWarning.peerId]?.name : undefined
        }
        onDisconnect={() => {
          if (keyChangeWarning) {
            disconnectPeer(keyChangeWarning.peerId);
            setKeyChangeWarning(null);
          }
        }}
        onTrust={() => {
          if (keyChangeWarning) {
            markPeerVerified(keyChangeWarning.peerId);
            setKeyChangeWarning(null);
          }
        }}
      />
    </div>
  );
}
