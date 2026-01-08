import { create } from "zustand";
import {
  GameSession,
  PendingGameInvite,
  GameMessage,
  GameMoveAction,
  RealTimeAction,
} from "../games/types";
import { gameRegistry } from "../games";
import { useP2PStore } from "./p2pStore";

interface GameState {
  // Active game session
  activeGame: GameSession | null;

  // Pending invites received from peers
  pendingInvites: PendingGameInvite[];

  // Actions
  setActiveGame: (game: GameSession | null) => void;
  addPendingInvite: (invite: PendingGameInvite) => void;
  removePendingInvite: (sessionId: string) => void;
  clearPendingInvites: () => void;

  // Game flow actions
  createGame: (gameType: string, guestId: string) => string | null;
  acceptInvite: (sessionId: string) => void;
  declineInvite: (sessionId: string) => void;
  makeMove: (payload: any) => void;
  restartGame: () => void;
  leaveGame: () => void;

  // Message handler
  handleGameMessage: (peerId: string, message: GameMessage) => void;
}

// Helper to generate session ID
const generateSessionId = () =>
  `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useGameStore = create<GameState>((set, get) => ({
  activeGame: null,
  pendingInvites: [],

  setActiveGame: (game) => set({ activeGame: game }),

  addPendingInvite: (invite) =>
    set((state) => ({
      pendingInvites: [...state.pendingInvites, invite],
    })),

  removePendingInvite: (sessionId) =>
    set((state) => ({
      pendingInvites: state.pendingInvites.filter(
        (inv) => inv.sessionId !== sessionId
      ),
    })),

  clearPendingInvites: () => set({ pendingInvites: [] }),

  /**
   * Create a new game and send invite to peer
   * Returns session ID if successful
   */
  createGame: (gameType, guestId) => {
    const { sendMessage, myId } = useP2PStore.getState();
    const game = gameRegistry.createInstance(gameType);

    if (!game || !myId) return null;

    const sessionId = generateSessionId();

    // Initialize game state immediately so UI doesn't crash while waiting
    const initialData = game.createInitialState(myId, guestId);

    // Create initial session (waiting for guest to accept)
    const session: GameSession = {
      id: sessionId,
      gameType,
      hostId: myId,
      guestId,
      status: "waiting",
      currentTurn: myId, // Host goes first
      winner: null,
      isDraw: false,
      data: initialData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({ activeGame: session });

    // Send invite to peer
    sendMessage(guestId, {
      type: "game_invite",
      gameType,
      sessionId,
      hostId: myId,
    });

    return sessionId;
  },

  /**
   * Accept a game invite
   */
  acceptInvite: (sessionId) => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();
    const invite = state.pendingInvites.find(
      (inv) => inv.sessionId === sessionId
    );

    if (!invite || !myId) return;

    const game = gameRegistry.createInstance(invite.gameType);
    if (!game) return;

    // Remove from pending
    state.removePendingInvite(sessionId);

    // Send accept message to host
    sendMessage(invite.hostId, {
      type: "game_accept",
      sessionId,
    });

    // Initialize local state
    const initialData = game.createInitialState(invite.hostId, myId);

    // Create local session (waiting for host to sync full state)
    const session: GameSession = {
      id: sessionId,
      gameType: invite.gameType,
      hostId: invite.hostId,
      guestId: myId,
      status: "waiting", // Will update to 'playing' when we get sync
      currentTurn: invite.hostId,
      winner: null,
      isDraw: false,
      data: initialData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({ activeGame: session });
  },

  /**
   * Decline a game invite
   */
  declineInvite: (sessionId) => {
    const state = get();
    const { sendMessage } = useP2PStore.getState();
    const invite = state.pendingInvites.find(
      (inv) => inv.sessionId === sessionId
    );

    if (!invite) return;

    state.removePendingInvite(sessionId);

    sendMessage(invite.hostId, {
      type: "game_decline",
      sessionId,
    });
  },

  /**
   * Make a move/action in the current game
   * Handles both turn-based and real-time games
   */
  makeMove: (payload) => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();
    const { activeGame } = state;

    if (!activeGame || activeGame.status !== "playing" || !myId) return;

    const game = gameRegistry.createInstance(activeGame.gameType);
    const gameDef = gameRegistry.getDefinition(activeGame.gameType);
    if (!game) return;

    const peerId =
      myId === activeGame.hostId ? activeGame.guestId : activeGame.hostId;

    // Check if game is real-time
    if (gameDef?.isRealTime) {
      // Real-time game: Apply action locally and broadcast
      const action: RealTimeAction = {
        type: "action",
        playerId: myId,
        timestamp: Date.now(),
        payload,
      };

      // Apply action locally (both players apply immediately)
      let newState = (game as any).applyAction(activeGame, action);

      // Check for game end (if game implements it)
      if (typeof (game as any).checkGameEnd === "function") {
        const endResult = (game as any).checkGameEnd(newState);
        if (endResult.isEnded) {
          newState = {
            ...newState,
            status: "finished",
            winner: endResult.winner,
            isDraw: endResult.isDraw,
          };
        }
      }

      newState.updatedAt = Date.now();
      set({ activeGame: newState });

      // Broadcast action to opponent (they will apply it too)
      sendMessage(peerId, {
        type: "game_realtime_action",
        sessionId: activeGame.id,
        action,
      });
    } else {
      // Turn-based game: Use existing host authority model
      const action: GameMoveAction = {
        type: "move",
        playerId: myId,
        timestamp: Date.now(),
        payload,
      };

      // Validate move
      if (!(game as any).isValidMove(activeGame, action)) {
        console.warn("Invalid move attempted");
        return;
      }

      const isHost = myId === activeGame.hostId;

      if (isHost) {
        // Host: Apply move locally and sync state to guest
        let newState = (game as any).applyMove(activeGame, action);

        // Check for game end
        const endResult = (game as any).checkGameEnd(newState);
        if (endResult.isEnded) {
          newState = {
            ...newState,
            status: "finished",
            winner: endResult.winner,
            isDraw: endResult.isDraw,
          };
        } else {
          // Switch turn
          newState = {
            ...newState,
            currentTurn: (game as any).getNextTurn(newState),
          };
        }

        newState.updatedAt = Date.now();
        set({ activeGame: newState });

        // Sync state to guest
        sendMessage(peerId, {
          type: "game_state_sync",
          sessionId: activeGame.id,
          state: newState,
        });
      } else {
        // Guest: Send action to host for processing
        sendMessage(peerId, {
          type: "game_action",
          sessionId: activeGame.id,
          action,
        });
      }
    }
  },

  /**
   * Restart the current game (rematch)
   * Resets board to initial state and syncs to opponent
   */
  restartGame: () => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();
    const { activeGame } = state;

    if (!activeGame || !myId) return;

    const game = gameRegistry.createInstance(activeGame.gameType);
    if (!game) return;

    const peerId =
      myId === activeGame.hostId ? activeGame.guestId : activeGame.hostId;

    // Reset game state
    const resetData = game.createInitialState(
      activeGame.hostId,
      activeGame.guestId
    );
    const newState: GameSession = {
      ...activeGame,
      status: "playing",
      currentTurn: activeGame.hostId, // Host always starts
      winner: null,
      isDraw: false,
      data: resetData,
      updatedAt: Date.now(),
    };

    set({ activeGame: newState });

    // Sync to opponent
    sendMessage(peerId, {
      type: "game_state_sync",
      sessionId: activeGame.id,
      state: newState,
    });
  },

  /**
   * Leave the current game
   */
  leaveGame: () => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();
    const { activeGame } = state;

    if (!activeGame || !myId) {
      set({ activeGame: null });
      return;
    }

    const peerId =
      myId === activeGame.hostId ? activeGame.guestId : activeGame.hostId;

    sendMessage(peerId, {
      type: "game_leave",
      sessionId: activeGame.id,
    });

    set({ activeGame: null });
  },

  /**
   * Handle incoming game messages from P2P
   */
  handleGameMessage: (peerId, message) => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();

    switch (message.type) {
      case "game_invite": {
        // Received invite from peer
        state.addPendingInvite({
          sessionId: message.sessionId,
          gameType: message.gameType,
          hostId: message.hostId,
          receivedAt: Date.now(),
        });
        break;
      }

      case "game_accept": {
        // Guest accepted our invite (we are host)
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId || !myId) break;

        const game = gameRegistry.createInstance(activeGame.gameType);
        if (!game) break;

        // Initialize game state
        const initialData = game.createInitialState(myId, activeGame.guestId);
        const newState: GameSession = {
          ...activeGame,
          status: "playing",
          data: initialData,
          updatedAt: Date.now(),
        };

        set({ activeGame: newState });

        // Sync initial state to guest
        sendMessage(activeGame.guestId, {
          type: "game_state_sync",
          sessionId: activeGame.id,
          state: newState,
        });
        break;
      }

      case "game_decline": {
        // Guest declined our invite
        const { activeGame } = state;
        if (activeGame?.id === message.sessionId) {
          set({ activeGame: null });
        }
        break;
      }

      case "game_action": {
        // Received action from guest (we are host)
        // Only for turn-based games
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId || !myId) break;
        if (myId !== activeGame.hostId) break; // Only host processes actions

        const game = gameRegistry.createInstance(activeGame.gameType);
        const gameDef = gameRegistry.getDefinition(activeGame.gameType);
        if (!game) break;

        // Skip if this is a real-time game (they use game_realtime_action instead)
        if (gameDef?.isRealTime) break;

        const action = message.action as GameMoveAction;

        // Validate and apply (turn-based game methods)
        if (!(game as any).isValidMove(activeGame, action)) {
          console.warn("Invalid move from guest");
          break;
        }

        let newState = (game as any).applyMove(activeGame, action);

        // Check for game end
        const endResult = (game as any).checkGameEnd(newState);
        if (endResult.isEnded) {
          newState = {
            ...newState,
            status: "finished",
            winner: endResult.winner,
            isDraw: endResult.isDraw,
          };
        } else {
          newState = {
            ...newState,
            currentTurn: (game as any).getNextTurn(newState),
          };
        }

        newState.updatedAt = Date.now();
        set({ activeGame: newState });

        // Sync back to guest
        sendMessage(activeGame.guestId, {
          type: "game_state_sync",
          sessionId: activeGame.id,
          state: newState,
        });
        break;
      }

      case "game_state_sync": {
        // Received state sync from host (we are guest)
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId) break;

        set({ activeGame: message.state });
        break;
      }

      case "game_realtime_action": {
        // Received real-time action from opponent
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId) break;

        const game = gameRegistry.createInstance(activeGame.gameType);
        if (!game) break;

        const action = message.action as RealTimeAction;

        // Apply action locally
        let newState = (game as any).applyAction(activeGame, action);

        // Check for game end (if game implements it)
        if (typeof (game as any).checkGameEnd === "function") {
          const endResult = (game as any).checkGameEnd(newState);
          if (endResult.isEnded) {
            newState = {
              ...newState,
              status: "finished",
              winner: endResult.winner,
              isDraw: endResult.isDraw,
            };
          }
        }

        newState.updatedAt = Date.now();
        set({ activeGame: newState });
        break;
      }

      case "game_leave": {
        // Peer left the game
        const { activeGame } = state;
        if (activeGame?.id === message.sessionId) {
          set({
            activeGame: {
              ...activeGame,
              status: "cancelled",
            },
          });
        }
        break;
      }
    }
  },
}));
