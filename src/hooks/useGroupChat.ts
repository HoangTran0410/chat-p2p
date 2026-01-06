import { useState, useCallback, useRef, useEffect } from "react";
import { Message } from "../types";
import {
  RoomSession,
  RoomMember,
  RoomProtocolMessage,
  RoomProtocolType,
  RoomJoinAcceptPayload,
  RoomMessagePayload,
  RoomMemberEventPayload,
  RoomHostChangedPayload,
  ROOM_PING_INTERVAL,
  ROOM_PING_TIMEOUT,
  MAX_ROOM_MEMBERS,
} from "../groupTypes";
import { generateId } from "../services/storage";

interface UseGroupChatProps {
  myId: string;
  myName?: string;
  sendMessage: (peerId: string, data: any) => boolean;
  connectToPeer: (peerId: string) => void;
  disconnectPeer: (peerId: string) => void;
  connectionStates: Record<string, string>;
  isReady: boolean;
}

interface UseGroupChatReturn {
  rooms: Record<string, RoomSession>;
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;

  // Room management
  createRoom: (name: string) => string; // returns roomId
  joinRoom: (hostPeerId: string) => void;
  leaveRoom: (roomId: string) => void;
  closeRoom: (roomId: string) => void; // Host only

  // Messaging
  sendRoomMessage: (roomId: string, content: string) => void;

  // Host status
  isHost: (roomId: string) => boolean;
  getRoomHost: (roomId: string) => RoomMember | undefined;

  // Handle incoming room messages
  handleRoomProtocol: (peerId: string, data: any) => boolean;
}

const STORAGE_KEY_PREFIX = "chat_p2p_rooms_";

export const useGroupChat = ({
  myId,
  myName,
  sendMessage,
  connectToPeer,
  disconnectPeer,
  connectionStates,
  isReady,
}: UseGroupChatProps): UseGroupChatReturn => {
  // State
  const [rooms, setRooms] = useState<Record<string, RoomSession>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load rooms from storage when myId is available
  useEffect(() => {
    if (!myId) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + myId);
      if (stored) {
        const parsedRooms = JSON.parse(stored);
        // Mark all members as offline initially (except self)
        Object.keys(parsedRooms).forEach((roomId) => {
          parsedRooms[roomId].members = parsedRooms[roomId].members.map(
            (m: RoomMember) => ({
              ...m,
              isOnline: m.peerId === myId,
            })
          );
        });
        setRooms(parsedRooms);
      } else {
        setRooms({});
      }
      setIsLoaded(true);
    } catch (e) {
      console.error("Failed to load rooms from storage:", e);
      setRooms({});
      setIsLoaded(true);
    }

    // Cleanup: reset loaded state if ID changes
    return () => setIsLoaded(false);
  }, [myId]);

  // Save rooms to storage (guarded by isLoaded)
  useEffect(() => {
    if (!myId || !isLoaded) return;
    localStorage.setItem(STORAGE_KEY_PREFIX + myId, JSON.stringify(rooms));
  }, [rooms, myId, isLoaded]);

  // Reconnect to hosts of stored rooms when ready
  useEffect(() => {
    if (!isReady || !isLoaded) return;

    Object.values(rooms).forEach((room) => {
      // If I'm not the host, reconnect to the host
      if (room.hostId !== myId) {
        console.log(
          "[GroupChat] Restoring connection to room host:",
          room.hostId
        );
        connectToPeer(room.hostId);
        // Queue join request to sync state (mark online)
        pendingJoinRef.current.set(room.roomId, room.hostId);
      }
    });
  }, [isReady, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refs for ping/pong mechanism
  const pingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastPongRef = useRef<Map<string, number>>(new Map());
  const pendingJoinRef = useRef<Map<string, string>>(new Map()); // roomId -> hostPeerId

  // Generate room ID from host peer ID and room name
  const generateRoomId = (hostPeerId: string, name: string): string => {
    // Sanitize name to be URL safe-ish (alphanumeric only)
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, "");
    return `room_${hostPeerId}_${sanitizedName}_${Date.now().toString(36)}`;
  };

  // Extract host peer ID from room ID
  const extractHostPeerId = (roomId: string): string | null => {
    // Format: room_{hostId}_{name}_{timestamp}
    if (roomId.startsWith("room_")) {
      const parts = roomId.split("_");
      if (parts.length >= 2) {
        return parts[1];
      }
    }
    // Legacy format: room-{hostId}
    if (roomId.startsWith("room-")) {
      return roomId.slice(5);
    }
    return null;
  };

  // Send room protocol message
  const sendRoomProtocol = useCallback(
    (
      peerId: string,
      type: RoomProtocolType,
      roomId: string,
      payload: any
    ): boolean => {
      const message: RoomProtocolMessage = {
        type,
        roomId,
        senderId: myId,
        payload,
        timestamp: Date.now(),
      };
      return sendMessage(peerId, message);
    },
    [myId, sendMessage]
  );

  // Broadcast to all room members (host only)
  const broadcastToRoom = useCallback(
    (
      roomId: string,
      type: RoomProtocolType,
      payload: any,
      excludePeerId?: string
    ) => {
      const room = rooms[roomId];
      if (!room || room.hostId !== myId) return;

      room.members.forEach((member) => {
        if (member.peerId !== myId && member.peerId !== excludePeerId) {
          sendRoomProtocol(member.peerId, type, roomId, payload);
        }
      });
    },
    [rooms, myId, sendRoomProtocol]
  );

  // ==================== Room Creation ====================
  const createRoom = useCallback(
    (name: string): string => {
      const roomId = generateRoomId(myId, name);

      const hostMember: RoomMember = {
        peerId: myId,
        name: myName,
        joinedAt: Date.now(),
        priority: 0,
        isHost: true,
        isOnline: true,
      };

      const newRoom: RoomSession = {
        roomId,
        name,
        hostId: myId,
        originalHostId: myId,
        members: [hostMember],
        messages: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setRooms((prev) => ({ ...prev, [roomId]: newRoom }));
      setActiveRoomId(roomId);

      console.log("[GroupChat] Created room:", roomId);
      return roomId;
    },
    [myId, myName]
  );

  // ==================== Room Join ====================
  const joinRoom = useCallback(
    (roomIdOrHostId: string) => {
      if (!isReady) {
        console.error("[GroupChat] Not ready to join room");
        return;
      }

      let roomId = roomIdOrHostId;
      let hostPeerId: string | null = null;

      // Check if input is a valid room ID (new format or legacy)
      if (
        roomIdOrHostId.startsWith("room_") ||
        roomIdOrHostId.startsWith("room-")
      ) {
        hostPeerId = extractHostPeerId(roomIdOrHostId);
      } else {
        // Assume input is just the hostPeerId (legacy behavior compatibility)
        // NOTE: This will only work for the old single-room format
        hostPeerId = roomIdOrHostId;
        roomId = `room-${hostPeerId}`; // Legacy fallback
      }

      if (!hostPeerId) {
        console.error("[GroupChat] Invalid room ID or host ID");
        return;
      }

      // Store pending join
      pendingJoinRef.current.set(roomId, hostPeerId);

      // Connect to host
      connectToPeer(hostPeerId);

      console.log(
        "[GroupChat] Connecting to room host:",
        hostPeerId,
        "for room:",
        roomId
      );
    },
    [isReady, connectToPeer]
  );

  // Actually send join request when connection is established
  useEffect(() => {
    pendingJoinRef.current.forEach((hostPeerId, roomId) => {
      const connState = connectionStates[hostPeerId];
      if (connState === "connected") {
        // Send join request
        sendRoomProtocol(hostPeerId, "room_join_request", roomId, {
          name: myName,
        });
        console.log("[GroupChat] Sent join request to:", hostPeerId);
        pendingJoinRef.current.delete(roomId);
      }
    });
  }, [connectionStates, sendRoomProtocol, myName]);

  // ==================== Room Leave ====================
  const leaveRoom = useCallback(
    (roomId: string) => {
      const room = rooms[roomId];
      if (!room) return;

      // Notify host (if not self)
      if (room.hostId !== myId) {
        sendRoomProtocol(room.hostId, "room_member_left", roomId, {
          member: { peerId: myId },
        });
        // Disconnect from host
        disconnectPeer(room.hostId);
      } else {
        // I'm the host, broadcast room close
        broadcastToRoom(roomId, "room_close", {});
        // Disconnect all members
        room.members.forEach((member) => {
          if (member.peerId !== myId) {
            disconnectPeer(member.peerId);
          }
        });
      }

      // Stop ping interval
      const interval = pingIntervalsRef.current.get(roomId);
      if (interval) {
        clearInterval(interval);
        pingIntervalsRef.current.delete(roomId);
      }

      // Remove room
      setRooms((prev) => {
        const { [roomId]: _, ...rest } = prev;
        return rest;
      });

      if (activeRoomId === roomId) {
        setActiveRoomId(null);
      }

      console.log("[GroupChat] Left room:", roomId);
    },
    [
      rooms,
      myId,
      activeRoomId,
      sendRoomProtocol,
      disconnectPeer,
      broadcastToRoom,
    ]
  );

  // ==================== Room Close (Host Only) ====================
  const closeRoom = useCallback(
    (roomId: string) => {
      const room = rooms[roomId];
      if (!room || room.hostId !== myId) return;

      leaveRoom(roomId);
    },
    [rooms, myId, leaveRoom]
  );

  // ==================== Send Message ====================
  const sendRoomMessage = useCallback(
    (roomId: string, content: string) => {
      const room = rooms[roomId];
      if (!room || !content.trim()) return;

      const messageId = generateId();
      const messagePayload: RoomMessagePayload = {
        messageId,
        content: content.trim(),
        type: "text",
      };

      const newMessage: Message = {
        id: messageId,
        senderId: myId,
        content: content.trim(),
        timestamp: Date.now(),
        status: "sent",
        type: "text",
      };

      if (room.hostId === myId) {
        // I'm host - add to local and broadcast
        setRooms((prev) => {
          const currentRoom = prev[roomId];
          if (!currentRoom) return prev;
          return {
            ...prev,
            [roomId]: {
              ...currentRoom,
              messages: [...currentRoom.messages, newMessage],
              lastUpdated: Date.now(),
            },
          };
        });

        // Broadcast to all members
        broadcastToRoom(roomId, "room_message", messagePayload);
      } else {
        // I'm member - send to host for relay
        sendRoomProtocol(room.hostId, "room_message", roomId, messagePayload);

        // Optimistically add to local
        setRooms((prev) => {
          const currentRoom = prev[roomId];
          if (!currentRoom) return prev;
          return {
            ...prev,
            [roomId]: {
              ...currentRoom,
              messages: [
                ...currentRoom.messages,
                { ...newMessage, status: "sending" },
              ],
              lastUpdated: Date.now(),
            },
          };
        });
      }
    },
    [rooms, myId, broadcastToRoom, sendRoomProtocol]
  );

  // ==================== Host Migration ====================
  const startHostMigration = useCallback(
    (roomId: string) => {
      const room = rooms[roomId];
      if (!room) return;

      // Find member with lowest priority (excluding old host)
      const candidates = room.members
        .filter((m) => m.peerId !== room.hostId && m.isOnline)
        .sort((a, b) => a.priority - b.priority);

      if (candidates.length === 0) {
        console.log("[GroupChat] No candidates for host migration");
        return;
      }

      const newHost = candidates[0];

      // Am I the new host?
      if (newHost.peerId === myId) {
        console.log("[GroupChat] I am becoming the new host");

        // Update local state
        setRooms((prev) => {
          const currentRoom = prev[roomId];
          if (!currentRoom) return prev;

          const updatedMembers = currentRoom.members.map((m) => ({
            ...m,
            isHost: m.peerId === myId,
            isOnline: m.peerId === room.hostId ? false : m.isOnline,
          }));

          return {
            ...prev,
            [roomId]: {
              ...currentRoom,
              hostId: myId,
              members: updatedMembers,
              lastUpdated: Date.now(),
            },
          };
        });

        // Notify other members
        const payload: RoomHostChangedPayload = {
          newHostId: myId,
          newHostPeerId: myId,
          members: room.members.map((m) => ({
            ...m,
            isHost: m.peerId === myId,
            isOnline: m.peerId === room.hostId ? false : m.isOnline,
          })),
        };

        room.members.forEach((member) => {
          if (member.peerId !== myId && member.peerId !== room.hostId) {
            sendRoomProtocol(
              member.peerId,
              "room_host_changed",
              roomId,
              payload
            );
          }
        });
      }
    },
    [rooms, myId, sendRoomProtocol]
  );

  // ==================== Ping/Pong Mechanism ====================
  const startPingInterval = useCallback(
    (roomId: string) => {
      // Clear existing interval
      const existing = pingIntervalsRef.current.get(roomId);
      if (existing) clearInterval(existing);

      const room = rooms[roomId];
      if (!room || room.hostId === myId) return; // Host doesn't ping

      lastPongRef.current.set(roomId, Date.now());

      const interval = setInterval(() => {
        const currentRoom = rooms[roomId];
        if (!currentRoom) {
          clearInterval(interval);
          pingIntervalsRef.current.delete(roomId);
          return;
        }

        // Send ping to host
        sendRoomProtocol(currentRoom.hostId, "room_ping", roomId, {});

        // Check if pong timeout
        const lastPong = lastPongRef.current.get(roomId) || 0;
        if (Date.now() - lastPong > ROOM_PING_TIMEOUT) {
          console.log("[GroupChat] Host timeout, starting migration");
          startHostMigration(roomId);
        }
      }, ROOM_PING_INTERVAL);

      pingIntervalsRef.current.set(roomId, interval);
    },
    [rooms, myId, sendRoomProtocol, startHostMigration]
  );

  // ==================== Protocol Message Handler ====================
  const handleRoomProtocol = useCallback(
    (peerId: string, data: any): boolean => {
      // Check if this is a room protocol message
      if (
        !data ||
        typeof data !== "object" ||
        !data.type ||
        !data.roomId ||
        !data.type.startsWith("room_")
      ) {
        return false;
      }

      const message = data as RoomProtocolMessage;
      const { type, roomId, senderId, payload } = message;

      console.log("[GroupChat] Received:", type, "from:", senderId);

      switch (type) {
        // ===== Host receives join request =====
        case "room_join_request": {
          const room = rooms[roomId];
          if (!room || room.hostId !== myId) break;

          // Check if member already exists
          const existingMemberIndex = room.members.findIndex(
            (m) => m.peerId === senderId
          );

          let updatedMembers: RoomMember[];

          if (existingMemberIndex !== -1) {
            // Update existing member
            updatedMembers = [...room.members];
            updatedMembers[existingMemberIndex] = {
              ...updatedMembers[existingMemberIndex],
              name: payload?.name || updatedMembers[existingMemberIndex].name,
              isOnline: true,
              // Keep other properties
            };
          } else {
            // Check member limit for new members
            if (room.members.length >= MAX_ROOM_MEMBERS) {
              sendRoomProtocol(senderId, "room_join_reject", roomId, {
                reason: "Room is full",
              });
              break;
            }

            // Add new member
            const newMember: RoomMember = {
              peerId: senderId,
              name: payload?.name,
              joinedAt: Date.now(),
              priority: room.members.length, // Lower priority
              isHost: false,
              isOnline: true,
            };

            updatedMembers = [...room.members, newMember];
          }

          // Update local state
          setRooms((prev) => ({
            ...prev,
            [roomId]: {
              ...prev[roomId],
              members: updatedMembers,
              lastUpdated: Date.now(),
            },
          }));

          // Send accept to new/returning member
          const acceptPayload: RoomJoinAcceptPayload = {
            roomName: room.name,
            members: updatedMembers,
            messages: room.messages.slice(-100), // Last 100 messages
            yourPriority:
              existingMemberIndex !== -1
                ? updatedMembers[existingMemberIndex].priority
                : updatedMembers[updatedMembers.length - 1].priority,
          };
          sendRoomProtocol(senderId, "room_join_accept", roomId, acceptPayload);

          // Broadcast to other members
          broadcastToRoom(
            roomId,
            "room_member_joined",
            {
              member:
                existingMemberIndex !== -1
                  ? updatedMembers[existingMemberIndex]
                  : updatedMembers[updatedMembers.length - 1],
            } as RoomMemberEventPayload,
            senderId
          );
          break;
        }

        // ===== Member receives join accept =====
        case "room_join_accept": {
          const acceptPayload = payload as RoomJoinAcceptPayload;

          // Create room session
          const newRoom: RoomSession = {
            roomId,
            name: acceptPayload.roomName,
            hostId: senderId,
            originalHostId: senderId,
            members: acceptPayload.members,
            messages: acceptPayload.messages || [],
            createdAt: Date.now(),
            lastUpdated: Date.now(),
          };

          setRooms((prev) => ({ ...prev, [roomId]: newRoom }));
          setActiveRoomId(roomId);

          // Start ping interval
          setTimeout(() => startPingInterval(roomId), 1000);

          console.log("[GroupChat] Joined room:", roomId);
          break;
        }

        // ===== Member receives join reject =====
        case "room_join_reject": {
          console.log("[GroupChat] Join rejected:", payload?.reason);
          // Disconnect from host
          disconnectPeer(senderId);
          break;
        }

        // ===== Host receives message from member =====
        case "room_message": {
          const room = rooms[roomId];
          if (!room) break;

          const msgPayload = payload as RoomMessagePayload;

          if (room.hostId === myId) {
            // I'm host - relay to all members
            const relayedMessage: Message = {
              id: msgPayload.messageId,
              senderId: senderId,
              content: msgPayload.content,
              timestamp: Date.now(),
              status: "delivered",
              type: msgPayload.type,
              file: msgPayload.file,
            };

            // Add to local
            setRooms((prev) => {
              const currentRoom = prev[roomId];
              if (!currentRoom) return prev;
              return {
                ...prev,
                [roomId]: {
                  ...currentRoom,
                  messages: [...currentRoom.messages, relayedMessage],
                  lastUpdated: Date.now(),
                },
              };
            });

            // Broadcast to all (including sender for confirmation)
            room.members.forEach((member) => {
              if (member.peerId !== myId) {
                sendRoomProtocol(member.peerId, "room_message", roomId, {
                  ...msgPayload,
                  senderPeerId: senderId,
                });
              }
            });
          } else {
            // I'm member - receiving relayed message
            const senderPeerId = (payload as any).senderPeerId || senderId;
            const receivedMessage: Message = {
              id: msgPayload.messageId,
              senderId: senderPeerId,
              content: msgPayload.content,
              timestamp: Date.now(),
              status: senderPeerId === myId ? "delivered" : "delivered",
              type: msgPayload.type,
              file: msgPayload.file,
            };

            setRooms((prev) => {
              const currentRoom = prev[roomId];
              if (!currentRoom) return prev;

              // Check if message already exists (from optimistic update)
              const exists = currentRoom.messages.some(
                (m) => m.id === receivedMessage.id
              );
              if (exists) {
                // Update status
                return {
                  ...prev,
                  [roomId]: {
                    ...currentRoom,
                    messages: currentRoom.messages.map((m) =>
                      m.id === receivedMessage.id
                        ? { ...m, status: "delivered" }
                        : m
                    ),
                    lastUpdated: Date.now(),
                  },
                };
              }

              return {
                ...prev,
                [roomId]: {
                  ...currentRoom,
                  messages: [...currentRoom.messages, receivedMessage],
                  lastUpdated: Date.now(),
                },
              };
            });
          }
          break;
        }

        // ===== Member joined notification =====
        case "room_member_joined": {
          const room = rooms[roomId];
          if (!room) break;

          const { member } = payload as RoomMemberEventPayload;
          setRooms((prev) => {
            const currentRoom = prev[roomId];
            if (!currentRoom) return prev;

            // Check if already exists
            if (currentRoom.members.some((m) => m.peerId === member.peerId)) {
              return prev;
            }

            return {
              ...prev,
              [roomId]: {
                ...currentRoom,
                members: [...currentRoom.members, member],
                lastUpdated: Date.now(),
              },
            };
          });
          break;
        }

        // ===== Member left notification =====
        case "room_member_left": {
          const room = rooms[roomId];
          if (!room) break;

          const { member } = payload as RoomMemberEventPayload;

          if (room.hostId === myId) {
            // I'm host - update and broadcast
            setRooms((prev) => {
              const currentRoom = prev[roomId];
              if (!currentRoom) return prev;

              const updatedMembers = currentRoom.members.filter(
                (m) => m.peerId !== member.peerId
              );

              return {
                ...prev,
                [roomId]: {
                  ...currentRoom,
                  members: updatedMembers,
                  lastUpdated: Date.now(),
                },
              };
            });

            broadcastToRoom(
              roomId,
              "room_member_left",
              { member },
              member.peerId
            );
          } else {
            // I'm member - update local
            setRooms((prev) => {
              const currentRoom = prev[roomId];
              if (!currentRoom) return prev;

              return {
                ...prev,
                [roomId]: {
                  ...currentRoom,
                  members: currentRoom.members.filter(
                    (m) => m.peerId !== member.peerId
                  ),
                  lastUpdated: Date.now(),
                },
              };
            });
          }
          break;
        }

        // ===== Host changed notification =====
        case "room_host_changed": {
          const { newHostId, members } = payload as RoomHostChangedPayload;

          setRooms((prev) => {
            const currentRoom = prev[roomId];
            if (!currentRoom) return prev;

            return {
              ...prev,
              [roomId]: {
                ...currentRoom,
                hostId: newHostId,
                members: members || currentRoom.members,
                lastUpdated: Date.now(),
              },
            };
          });

          // Reconnect to new host if needed
          if (newHostId !== myId) {
            connectToPeer(newHostId);
            setTimeout(() => startPingInterval(roomId), 1000);
          }
          break;
        }

        // ===== Room closed =====
        case "room_close": {
          leaveRoom(roomId);
          break;
        }

        // ===== Ping (host receives) =====
        case "room_ping": {
          const room = rooms[roomId];
          if (!room || room.hostId !== myId) break;

          // Respond with pong
          sendRoomProtocol(senderId, "room_pong", roomId, {});
          break;
        }

        // ===== Pong (member receives) =====
        case "room_pong": {
          lastPongRef.current.set(roomId, Date.now());
          break;
        }

        default:
          console.log("[GroupChat] Unknown message type:", type);
      }

      return true;
    },
    [
      rooms,
      myId,
      sendRoomProtocol,
      broadcastToRoom,
      disconnectPeer,
      connectToPeer,
      leaveRoom,
      startPingInterval,
    ]
  );

  // ==================== Helper Functions ====================
  const isHost = useCallback(
    (roomId: string): boolean => {
      const room = rooms[roomId];
      return room?.hostId === myId;
    },
    [rooms, myId]
  );

  const getRoomHost = useCallback(
    (roomId: string): RoomMember | undefined => {
      const room = rooms[roomId];
      if (!room) return undefined;
      return room.members.find((m) => m.isHost);
    },
    [rooms]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pingIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pingIntervalsRef.current.clear();
    };
  }, []);

  return {
    rooms,
    activeRoomId,
    setActiveRoomId,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    sendRoomMessage,
    isHost,
    getRoomHost,
    handleRoomProtocol,
  };
};
