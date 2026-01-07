import { create } from "zustand";
import { Peer, DataConnection } from "peerjs";
import { PeerConnectionStatus, PeerConfig } from "../types";
import { DEFAULT_PEER_CONFIG, MAX_CONNECTIONS } from "../constants";

// Event types
type P2PEventType =
  | "message"
  | "connectionOpened"
  | "connectionClosed"
  | "connectionLimitExceeded";

type P2PEventCallback = (peerId: string, data?: any) => void;

interface P2PState {
  // State
  myId: string;
  isReady: boolean;
  isReconnecting: boolean;
  peerError: string | null;
  connectionStates: Record<string, PeerConnectionStatus>;

  // Computed
  activeConnectionsCount: number;

  // Actions
  addListener: (event: P2PEventType, callback: P2PEventCallback) => () => void;
  emit: (event: P2PEventType, peerId: string, data?: any) => void;
  handleConnection: (conn: DataConnection) => void;
  initPeer: (sessionId: string, config?: PeerConfig) => void;
  destroyPeer: () => void;
  connectToPeer: (peerId: string) => void;
  disconnectPeer: (peerId: string) => void;
  sendMessage: (peerId: string, data: any) => boolean;
  updateId: (newId: string, config?: PeerConfig) => void;
  updatePeerState: (peerId: string, status: PeerConnectionStatus) => void;
}

// Non-reactive state (stored outside Zustand for performance)
let peerInstance: Peer | null = null;
const connections = new Map<string, DataConnection>();
const connectionOrder: string[] = [];
let currentConfig: PeerConfig = DEFAULT_PEER_CONFIG;

// Event listeners storage (outside Zustand to avoid re-renders)
const eventListeners: Record<P2PEventType, Set<P2PEventCallback>> = {
  message: new Set(),
  connectionOpened: new Set(),
  connectionClosed: new Set(),
  connectionLimitExceeded: new Set(),
};

export const useP2PStore = create<P2PState>((set, get) => ({
  // Initial state
  myId: "",
  isReady: false,
  isReconnecting: false,
  peerError: null,
  connectionStates: {},
  activeConnectionsCount: 0,

  // Add event listener - returns cleanup function
  addListener: (event, callback) => {
    eventListeners[event].add(callback);
    return () => eventListeners[event].delete(callback);
  },

  // Emit event to all listeners
  emit: (event, peerId, data) => {
    eventListeners[event].forEach((callback) => callback(peerId, data));
  },

  // Update peer state
  updatePeerState: (peerId, status) =>
    set((state) => ({
      connectionStates: { ...state.connectionStates, [peerId]: status },
    })),

  // Handle incoming connection
  handleConnection: (conn: DataConnection) => {
    const state = get();
    state.updatePeerState(conn.peer, "connecting");

    conn.on("open", () => {
      const currentState = get();

      // Check connection limit
      if (connections.size >= MAX_CONNECTIONS) {
        const oldestPeerId = connectionOrder[0];
        if (oldestPeerId) {
          const oldConn = connections.get(oldestPeerId);
          if (oldConn) {
            oldConn.close();
          }
          connections.delete(oldestPeerId);
          const idx = connectionOrder.indexOf(oldestPeerId);
          if (idx > -1) connectionOrder.splice(idx, 1);
          currentState.updatePeerState(oldestPeerId, "disconnected");
          currentState.emit("connectionClosed", oldestPeerId);
          currentState.emit("connectionLimitExceeded", oldestPeerId);
        }
      }

      connections.set(conn.peer, conn);
      connectionOrder.push(conn.peer);
      currentState.updatePeerState(conn.peer, "connected");
      currentState.emit("connectionOpened", conn.peer);

      // Update active count
      set({
        activeConnectionsCount: Array.from(connections.values()).filter(
          (c) => c?.open
        ).length,
      });

      // Broadcast "I'm online" to this peer
      conn.send({ type: "presence", status: "online" });
    });

    conn.on("data", (data: any) => {
      const currentState = get();
      if (data && typeof data === "object" && data.type === "presence") {
        return;
      }
      currentState.emit("message", conn.peer, data);
    });

    conn.on("close", () => {
      const currentState = get();
      connections.delete(conn.peer);
      const idx = connectionOrder.indexOf(conn.peer);
      if (idx > -1) connectionOrder.splice(idx, 1);
      currentState.updatePeerState(conn.peer, "disconnected");
      currentState.emit("connectionClosed", conn.peer);

      // Update active count
      set({
        activeConnectionsCount: Array.from(connections.values()).filter(
          (c) => c?.open
        ).length,
      });
    });

    conn.on("error", (err) => {
      console.error("Connection-specific error:", err);
      connections.delete(conn.peer);
      get().updatePeerState(conn.peer, "failed");
    });
  },

  // Initialize peer
  initPeer: (sessionId, config = DEFAULT_PEER_CONFIG) => {
    currentConfig = config;
    set({ isReconnecting: true, myId: sessionId });

    // @ts-ignore - PeerJS global fallback
    const PeerClass = (window.Peer as any) || Peer;

    const newPeer = new PeerClass(sessionId, {
      host: config.host,
      port: config.port,
      path: config.path,
      secure: config.secure,
      debug: config.debug || 0,
    });

    newPeer.on("open", (id: string) => {
      console.log("My Peer ID is: " + id);
      set({ isReady: true, isReconnecting: false, peerError: null });
    });

    newPeer.on("connection", (conn: DataConnection) => {
      get().handleConnection(conn);
    });

    newPeer.on("disconnected", () => {
      console.log("Peer disconnected from server.");
      set({ isReady: false });

      setTimeout(() => {
        if (peerInstance && !peerInstance.destroyed) {
          console.log("Attempting to reconnect...");
          set({ isReconnecting: true });
          peerInstance.reconnect();
        }
      }, 3000);
    });

    newPeer.on("error", (err: any) => {
      console.error("PeerJS error:", err);
      set({ isReconnecting: false });

      if (err.type === "unavailable-id") {
        set({
          peerError: "ID is already taken. Please choose another.",
          isReady: false,
        });
      } else if (err.message && err.message.includes("is taken")) {
        set({ peerError: `ID is taken: ${err.message}`, isReady: false });
      } else if (err.type === "peer-unavailable") {
        const msg = err.message || "";
        const match = msg.match(/Could not connect to peer (.*)/);
        if (match && match[1]) {
          get().updatePeerState(match[1], "failed");
        }
      } else if (err.type === "network" || err.type === "disconnected") {
        set({ isReady: false, peerError: "Network error. Reconnecting..." });
        setTimeout(() => {
          if (peerInstance && !peerInstance.destroyed) {
            set({ isReconnecting: true });
            peerInstance.reconnect();
          }
        }, 3000);
      } else {
        set({
          peerError: "Connection error: " + (err.message || "Unknown error"),
        });
      }
    });

    peerInstance = newPeer;

    // Cleanup on page unload
    const handleUnload = () => {
      newPeer?.destroy();
    };
    window.addEventListener("beforeunload", handleUnload);
  },

  // Destroy peer
  destroyPeer: () => {
    if (peerInstance) {
      peerInstance.destroy();
      peerInstance = null;
    }
    connections.clear();
    connectionOrder.length = 0;
    set({
      connectionStates: {},
      isReady: false,
      activeConnectionsCount: 0,
    });
  },

  // Connect to peer
  connectToPeer: (peerId) => {
    const state = get();
    if (!peerInstance || !state.isReady) return;

    // Check if already connected
    if (connections.has(peerId)) {
      const conn = connections.get(peerId);
      if (conn?.open) {
        state.updatePeerState(peerId, "connected");
        return;
      }
    }

    state.updatePeerState(peerId, "connecting");

    try {
      const conn = peerInstance.connect(peerId, { reliable: true });
      state.handleConnection(conn);

      // Timeout fallback
      setTimeout(() => {
        set((s) => {
          if (s.connectionStates[peerId] === "connecting") {
            return {
              connectionStates: { ...s.connectionStates, [peerId]: "failed" },
            };
          }
          return s;
        });
      }, 10000);
    } catch (e) {
      console.error("Connect error", e);
      state.updatePeerState(peerId, "failed");
    }
  },

  // Disconnect peer
  disconnectPeer: (peerId) => {
    const conn = connections.get(peerId);
    if (conn) {
      conn.close();
      connections.delete(peerId);
    }
    const idx = connectionOrder.indexOf(peerId);
    if (idx > -1) connectionOrder.splice(idx, 1);
    get().updatePeerState(peerId, "disconnected");
    set({
      activeConnectionsCount: Array.from(connections.values()).filter(
        (c) => c?.open
      ).length,
    });
  },

  // Send message
  sendMessage: (peerId, data) => {
    const conn = connections.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
      return true;
    }
    return false;
  },

  // Update ID (recreate peer with new ID)
  updateId: (newId, config) => {
    const state = get();
    if (!newId || newId === state.myId) return;

    // Cleanup old peer
    state.destroyPeer();

    set({ peerError: null });
    state.initPeer(newId, config || currentConfig);
  },
}));
