import { useState, useEffect, useRef, useCallback } from "react";
import { Peer, DataConnection } from "peerjs";
import { generateId, getStoredUserId, storeUserId } from "../services/storage";
import { PeerConnectionStatus, PeerConfig } from "../types";
import { DEFAULT_PEER_CONFIG, MAX_CONNECTIONS } from "../constants";

interface UseP2PProps {
  config?: PeerConfig;
  onMessageReceived: (peerId: string, data: any) => void;
  onConnectionOpened: (peerId: string) => void;
  onConnectionClosed: (peerId: string) => void;
  onConnectionLimitExceeded?: (disconnectedPeerId: string) => void;
}

export const useP2P = ({
  config = DEFAULT_PEER_CONFIG,
  onMessageReceived,
  onConnectionOpened,
  onConnectionClosed,
  onConnectionLimitExceeded,
}: UseP2PProps) => {
  const [myId, setMyId] = useState<string>("");
  const [peer, setPeer] = useState<Peer | null>(null);

  // Track specific connection objects
  const connections = useRef<Map<string, DataConnection>>(new Map());
  // Track connection order for oldest detection
  const connectionOrder = useRef<string[]>([]);

  // Track detailed state for each peer ID
  const [connectionStates, setConnectionStates] = useState<
    Record<string, PeerConnectionStatus>
  >({});

  const [isReady, setIsReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false); // New state for reconnect spinner
  const [peerError, setPeerError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null); // Transient errors

  const updatePeerState = (peerId: string, status: PeerConnectionStatus) => {
    setConnectionStates((prev) => ({ ...prev, [peerId]: status }));
  };

  const handleConnection = useCallback(
    (conn: DataConnection) => {
      // If we receive a connection, mark it as connecting immediately
      updatePeerState(conn.peer, "connecting");

      conn.on("open", () => {
        // Check connection limit
        if (connections.current.size >= MAX_CONNECTIONS) {
          // Disconnect oldest
          const oldestPeerId = connectionOrder.current[0];
          if (oldestPeerId) {
            const oldConn = connections.current.get(oldestPeerId);
            if (oldConn) {
              oldConn.close();
            }
            connections.current.delete(oldestPeerId);
            connectionOrder.current = connectionOrder.current.filter(
              (id) => id !== oldestPeerId
            );
            updatePeerState(oldestPeerId, "disconnected");
            onConnectionClosed(oldestPeerId);
            if (onConnectionLimitExceeded) {
              onConnectionLimitExceeded(oldestPeerId);
            }
          }
        }

        connections.current.set(conn.peer, conn);
        connectionOrder.current.push(conn.peer);
        updatePeerState(conn.peer, "connected");
        onConnectionOpened(conn.peer);

        // Broadcast "I'm online" to this peer
        conn.send({ type: "presence", status: "online" });
      });

      conn.on("data", (data: any) => {
        // Handle presence messages - just acknowledge online status
        if (data && typeof data === "object" && data.type === "presence") {
          // Peer is online - no action needed, connection state already updated
          return;
        }
        onMessageReceived(conn.peer, data);
      });

      conn.on("close", () => {
        connections.current.delete(conn.peer);
        connectionOrder.current = connectionOrder.current.filter(
          (id) => id !== conn.peer
        );
        updatePeerState(conn.peer, "disconnected");
        onConnectionClosed(conn.peer);
      });

      conn.on("error", (err) => {
        console.error("Connection-specific error:", err);
        connections.current.delete(conn.peer);
        updatePeerState(conn.peer, "failed");
      });
    },
    [onConnectionOpened, onConnectionClosed, onMessageReceived]
  );

  const destroyPeer = useCallback(() => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    connections.current.clear();
    setConnectionStates({});
    setIsReady(false);
  }, [peer]);

  const initPeer = useCallback(
    (id: string) => {
      setIsReconnecting(true); // Start connecting/reconnecting
      // @ts-ignore
      const PeerClass = (window.Peer as any) || Peer;

      const newPeer = new PeerClass(id, {
        host: config.host,
        port: config.port,
        path: config.path,
        secure: config.secure,
        debug: config.debug || 0,
      });

      newPeer.on("open", (id: string) => {
        console.log("My Peer ID is: " + id);
        setIsReady(true);
        setIsReconnecting(false); // Connected
        setPeerError(null);
      });

      newPeer.on("connection", (conn: DataConnection) => {
        handleConnection(conn);
      });

      newPeer.on("disconnected", () => {
        console.log("Peer disconnected from server.");
        setIsReady(false);
        // setPeerError("Disconnected. Reconnecting...");

        // Auto-reconnect attempt
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            console.log("Attempting to reconnect...");
            setIsReconnecting(true); // Mark as reconnecting during attempt
            newPeer.reconnect();
          }
        }, 3000);
      });

      newPeer.on("error", (err: any) => {
        console.error("PeerJS error:", err);
        setIsReconnecting(false); // Stop spinning on error

        // Handle ID taken (fatal for this session)
        if (err.type === "unavailable-id") {
          setPeerError("ID is already taken. Please choose another.");
          setIsReady(false);
          // Do NOT auto-reconnect for fatal ID errors
        }
        // Handle generic errors that might be ID conflicts (PeerJS sometimes behaves inconsistently)
        else if (err.message && err.message.includes("is taken")) {
          setPeerError(`ID is taken: ${err.message}`);
          setIsReady(false);
          // Do NOT auto-reconnect for fatal ID errors
        }
        // Handle peer not found (transient for specific connection)
        else if (err.type === "peer-unavailable") {
          // Extract peer ID from message if possible, though PeerJS error object structure varies.
          // Usually we know who we were trying to connect to via context, but here it's global.
          // We will rely on the timeout or UI state to handle specific peer failures usually,
          // but let's try to notify global error.
          const msg = err.message || "";
          const match = msg.match(/Could not connect to peer (.*)/);
          if (match && match[1]) {
            updatePeerState(match[1], "failed");
            setConnectionError(`User '${match[1]}' not found or offline.`);
          } else {
            setConnectionError("Peer not found or offline.");
          }
        }
        // Handle lost connection to server
        else if (err.type === "network" || err.type === "disconnected") {
          setIsReady(false);
          setPeerError("Network error. Reconnecting...");
          // Retry happens via disconnected event usually, but if not:
          setTimeout(() => {
            if (newPeer && !newPeer.destroyed) {
              setIsReconnecting(true);
              newPeer.reconnect();
            }
          }, 3000);
        } else {
          setPeerError("Connection error: " + (err.message || "Unknown error"));
        }
      });

      setPeer(newPeer);
      return newPeer;
    },
    [handleConnection]
  );

  // Initial load
  useEffect(() => {
    let existingId = getStoredUserId();
    if (!existingId) {
      existingId = generateId();
      storeUserId(existingId);
    }
    setMyId(existingId);
    // Initialize with current config
    const newPeer = initPeer(existingId);

    // Cleanup on page unload to prevent "ID already taken" error
    const handleUnload = () => {
      newPeer?.destroy();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      newPeer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); // Re-init on config change

  const updateId = useCallback(
    (newId: string) => {
      if (!newId || newId === myId) return;

      // Cleanup old peer
      if (peer) {
        peer.destroy();
      }
      connections.current.clear();
      setConnectionStates({});
      setIsReady(false);
      setPeerError(null);
      setConnectionError(null);

      // Set new ID and init
      storeUserId(newId);
      setMyId(newId);
      initPeer(newId);
    },
    [myId, peer, initPeer]
  );

  const connectToPeer = useCallback(
    (peerId: string) => {
      if (!peer || !isReady) return;

      // Check if already connected
      if (connections.current.has(peerId)) {
        const conn = connections.current.get(peerId);
        if (conn?.open) {
          updatePeerState(peerId, "connected");
          return;
        }
      }

      updatePeerState(peerId, "connecting");

      try {
        const conn = peer.connect(peerId, { reliable: true });
        handleConnection(conn);

        // Timeout fallback if PeerJS hangs on 'connecting'
        setTimeout(() => {
          setConnectionStates((prev) => {
            if (prev[peerId] === "connecting") {
              return { ...prev, [peerId]: "failed" };
            }
            return prev;
          });
        }, 10000); // 10s timeout
      } catch (e) {
        console.error("Connect error", e);
        updatePeerState(peerId, "failed");
      }
    },
    [peer, isReady, handleConnection]
  );

  const disconnectPeer = useCallback((peerId: string) => {
    const conn = connections.current.get(peerId);
    if (conn) {
      conn.close();
      connections.current.delete(peerId);
    }
    updatePeerState(peerId, "disconnected");
  }, []);

  const sendMessage = useCallback((peerId: string, data: any) => {
    const conn = connections.current.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
      return true;
    }
    return false;
  }, []);

  const resetConnectionError = () => setConnectionError(null);

  return {
    myId,
    isReady,
    isReconnecting,
    peerError,
    connectionError,
    resetConnectionError,
    connectionStates, // Exposed map of states
    activeConnectionsCount: Array.from(connections.current.values()).filter(
      (c) => c?.["open"]
    ).length,
    connectToPeer,
    disconnectPeer,
    sendMessage,
    updateId,
  };
};
