import { create } from "zustand";
import { parseUrlHash } from "../utils";
import { ChatSession, PeerConfig, UserSession } from "../types";
import { DEFAULT_PEER_CONFIG } from "../constants";
import {
  generateId,
  storeSession,
  deleteSession as deleteStoredSession,
  setActiveSessionId as setActiveSessionIdStorage,
} from "../services/storage";
import {
  getAllChatsFromDB,
  saveChatToDB,
  deleteChatFromDB,
  deleteAllChatsForSession,
} from "../services/db";

interface AppState {
  // Data state
  chats: Record<string, ChatSession>;
  isStorageReady: boolean;
  typingStates: Record<string, boolean>;
  sessions: UserSession[];
  activeSessionId: string;
  peerConfig: PeerConfig;

  // UI state
  selectedPeerId: string | null;
  showMobileDashboard: boolean;

  // Modal states
  showSettings: boolean;
  showNewSessionDialog: boolean;

  // Pending states from URL
  pendingConnectPeerId: string | null;

  // Data actions
  setChats: (
    chats:
      | Record<string, ChatSession>
      | ((prev: Record<string, ChatSession>) => Record<string, ChatSession>)
  ) => void;
  setIsStorageReady: (ready: boolean) => void;
  setTypingStates: (
    states:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setSessions: (
    sessions: UserSession[] | ((prev: UserSession[]) => UserSession[])
  ) => void;
  setActiveSessionId: (id: string) => void;
  setPeerConfig: (config: PeerConfig) => void;

  // UI actions
  setSelectedPeerId: (peerId: string | null) => void;
  setShowMobileDashboard: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowNewSessionDialog: (show: boolean) => void;
  setPendingConnectPeerId: (peerId: string | null) => void;

  // Convenience actions
  selectChat: (peerId: string) => void;
  backToSidebar: () => void;

  // Chat actions
  renameChat: (peerId: string, newName: string) => void;
  deleteChat: (peerId: string, disconnectPeer: (id: string) => void) => void;

  // Session actions
  switchSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const { pendingConnect } = parseUrlHash();

// Load peer config from localStorage
const loadPeerConfig = (): PeerConfig => {
  try {
    const saved = localStorage.getItem("peer_config");
    return saved ? JSON.parse(saved) : DEFAULT_PEER_CONFIG;
  } catch {
    return DEFAULT_PEER_CONFIG;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial data state
  chats: {},
  isStorageReady: false,
  typingStates: {},
  sessions: [],
  activeSessionId: "",
  peerConfig: loadPeerConfig(),

  // Initial UI state
  selectedPeerId: null,
  showMobileDashboard: false,
  showSettings: false,
  showNewSessionDialog: false,
  pendingConnectPeerId: pendingConnect,

  // Data setters
  setChats: (chatsOrUpdater) =>
    set((state) => ({
      chats:
        typeof chatsOrUpdater === "function"
          ? chatsOrUpdater(state.chats)
          : chatsOrUpdater,
    })),
  setIsStorageReady: (ready) => set({ isStorageReady: ready }),
  setTypingStates: (statesOrUpdater) =>
    set((state) => ({
      typingStates:
        typeof statesOrUpdater === "function"
          ? statesOrUpdater(state.typingStates)
          : statesOrUpdater,
    })),
  setSessions: (sessionsOrUpdater) =>
    set((state) => ({
      sessions:
        typeof sessionsOrUpdater === "function"
          ? sessionsOrUpdater(state.sessions)
          : sessionsOrUpdater,
    })),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setPeerConfig: (config) => {
    localStorage.setItem("peer_config", JSON.stringify(config));
    set({ peerConfig: config });
  },

  // UI setters
  setSelectedPeerId: (peerId) => set({ selectedPeerId: peerId }),
  setShowMobileDashboard: (show) => set({ showMobileDashboard: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowNewSessionDialog: (show) => set({ showNewSessionDialog: show }),
  setPendingConnectPeerId: (peerId) => set({ pendingConnectPeerId: peerId }),

  // Convenience actions
  selectChat: (peerId) =>
    set({
      selectedPeerId: peerId,
      showMobileDashboard: false,
    }),
  backToSidebar: () =>
    set({
      selectedPeerId: null,
      showMobileDashboard: false,
    }),

  // Chat actions
  renameChat: (peerId, newName) => {
    const state = get();
    const chat = state.chats[peerId];
    if (!chat) return;

    const updatedChat = {
      ...chat,
      name: newName.trim() === "" ? undefined : newName.trim(),
    };

    saveChatToDB(state.activeSessionId, updatedChat);
    set({ chats: { ...state.chats, [peerId]: updatedChat } });
  },

  deleteChat: (peerId, disconnectPeer) => {
    const state = get();
    if (!peerId) return;

    if (confirm("Are you sure you want to delete this conversation?")) {
      disconnectPeer(peerId);
      const newChats = { ...state.chats };
      delete newChats[peerId];
      deleteChatFromDB(state.activeSessionId, peerId);
      set({ chats: newChats, selectedPeerId: null });
    }
  },

  // Session actions
  switchSession: async (sessionId) => {
    const state = get();
    if (sessionId === state.activeSessionId) return;

    // Clear current state
    set({ selectedPeerId: null, chats: {} });

    // Update active session
    setActiveSessionIdStorage(sessionId);
    set({ activeSessionId: sessionId });

    // Load chats for new session
    try {
      const storedChats = await getAllChatsFromDB(sessionId);
      set({ chats: storedChats });
    } catch (e) {
      console.error("Failed to load chats for session:", e);
    }
  },

  createNewSession: async () => {
    const state = get();
    const newId = generateId();
    const newSession: UserSession = {
      id: newId,
      createdAt: Date.now(),
    };

    // Store new session
    storeSession(newSession);

    // Update state
    const updatedSessions = [...state.sessions, newSession];

    // Switch to new session
    setActiveSessionIdStorage(newId);
    set({
      sessions: updatedSessions,
      activeSessionId: newId,
      chats: {},
      selectedPeerId: null,
      showNewSessionDialog: false,
    });
  },

  deleteSession: async (sessionId) => {
    const state = get();
    if (sessionId === state.activeSessionId) return; // Can't delete active session

    // Delete session from storage
    deleteStoredSession(sessionId);

    // Delete all chats for this session
    try {
      await deleteAllChatsForSession(sessionId);
    } catch (e) {
      console.error("Failed to delete chats for session:", e);
    }

    // Update sessions list
    set({ sessions: state.sessions.filter((s) => s.id !== sessionId) });
  },
}));
