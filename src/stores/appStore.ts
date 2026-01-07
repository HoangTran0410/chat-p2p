import { create } from "zustand";
import { parseUrlHash } from "../utils";

interface AppState {
  // View state
  viewMode: "chats" | "rooms";
  selectedPeerId: string | null;
  activeRoomId: string | null;
  showMobileDashboard: boolean;

  // Modal states
  showSettings: boolean;
  showNewSessionDialog: boolean;
  showCreateRoomModal: boolean;
  showJoinRoomModal: boolean;

  // Pending states from URL
  pendingConnectPeerId: string | null;
  pendingRoomId: string | null;

  // Actions
  setViewMode: (mode: "chats" | "rooms") => void;
  setSelectedPeerId: (peerId: string | null) => void;
  setActiveRoomId: (roomId: string | null) => void;
  setShowMobileDashboard: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowNewSessionDialog: (show: boolean) => void;
  setShowCreateRoomModal: (show: boolean) => void;
  setShowJoinRoomModal: (show: boolean) => void;
  setPendingConnectPeerId: (peerId: string | null) => void;
  setPendingRoomId: (roomId: string | null) => void;

  // Convenience actions
  selectChat: (peerId: string) => void;
  selectRoom: (roomId: string) => void;
  backToSidebar: () => void;
}

const { pendingConnect, pendingRoom } = parseUrlHash();

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  viewMode: pendingRoom ? "rooms" : "chats",
  selectedPeerId: null,
  activeRoomId: null,
  showMobileDashboard: false,
  showSettings: false,
  showNewSessionDialog: false,
  showCreateRoomModal: false,
  showJoinRoomModal: false,
  pendingConnectPeerId: pendingConnect,
  pendingRoomId: pendingRoom,

  // Basic setters
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedPeerId: (peerId) => set({ selectedPeerId: peerId }),
  setActiveRoomId: (roomId) => set({ activeRoomId: roomId }),
  setShowMobileDashboard: (show) => set({ showMobileDashboard: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowNewSessionDialog: (show) => set({ showNewSessionDialog: show }),
  setShowCreateRoomModal: (show) => set({ showCreateRoomModal: show }),
  setShowJoinRoomModal: (show) => set({ showJoinRoomModal: show }),
  setPendingConnectPeerId: (peerId) => set({ pendingConnectPeerId: peerId }),
  setPendingRoomId: (roomId) => set({ pendingRoomId: roomId }),

  // Convenience actions
  selectChat: (peerId) =>
    set({
      selectedPeerId: peerId,
      activeRoomId: null,
      showMobileDashboard: false,
      viewMode: "chats",
    }),
  selectRoom: (roomId) =>
    set({
      activeRoomId: roomId,
      selectedPeerId: null,
      showMobileDashboard: false,
      viewMode: "rooms",
    }),
  backToSidebar: () =>
    set({
      selectedPeerId: null,
      activeRoomId: null,
      showMobileDashboard: false,
    }),
}));
