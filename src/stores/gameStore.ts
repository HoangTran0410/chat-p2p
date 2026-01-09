import { create } from "zustand";
import { GameSession, PendingGameInvite, GameMessage } from "../games/types";
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
  createGame: (gameType: string, clientId: string) => string | null;
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
  createGame: (gameType, clientId) => {
    const { sendMessage, myId } = useP2PStore.getState();
    const game = gameRegistry.createInstance(gameType);

    if (!game || !myId) return null;

    const sessionId = generateSessionId();

    // Initialize game state immediately so UI doesn't crash while waiting
    const initialData = game.createInitialState(myId, clientId);

    // Create initial session (waiting for client to accept)
    const session: GameSession = {
      id: sessionId,
      gameType,
      hostId: myId,
      clientId,
      status: "waiting",
      winner: null,
      isDraw: false,
      data: initialData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({ activeGame: session });

    // Send invite to peer
    sendMessage(clientId, {
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
      clientId: myId,
      status: "waiting", // Will update to 'playing' when we get sync
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
   * Uses new BaseGame architecture with client-side prediction
   */
  makeMove: (payload) => {
    const state = get();
    const { sendMessage, myId } = useP2PStore.getState();
    const { activeGame } = state;

    if (!activeGame || activeGame.status !== "playing" || !myId) return;

    const game = gameRegistry.createInstance(activeGame.gameType);
    if (!game) return;

    const isHost = myId === activeGame.hostId;
    const peerId = isHost ? activeGame.clientId : activeGame.hostId;

    // CLIENT-SIDE PREDICTION: Apply input immediately for instant feedback
    let newState = game.handleInput(activeGame, payload, myId, isHost);

    // Check for game end (if game implements it)
    if (game.checkGameEnd) {
      const endResult = game.checkGameEnd(newState);
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

    if (isHost) {
      // Host: Send input to client AND sync authoritative state
      sendMessage(peerId, {
        type: "game_input",
        sessionId: activeGame.id,
        playerId: myId,
        input: payload,
      });

      // Also sync state for reconciliation
      sendMessage(peerId, {
        type: "game_state_sync",
        sessionId: activeGame.id,
        state: newState,
      });
    } else {
      // Client: Send input to host for validation
      sendMessage(peerId, {
        type: "game_input",
        sessionId: activeGame.id,
        playerId: myId,
        input: payload,
      });
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
      myId === activeGame.hostId ? activeGame.clientId : activeGame.hostId;

    // Reset game state
    const resetData = game.createInitialState(
      activeGame.hostId,
      activeGame.clientId
    );
    const newState: GameSession = {
      ...activeGame,
      status: "playing",
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
      myId === activeGame.hostId ? activeGame.clientId : activeGame.hostId;

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
        const initialData = game.createInitialState(myId, activeGame.clientId);
        const newState: GameSession = {
          ...activeGame,
          status: "playing",
          data: initialData,
          updatedAt: Date.now(),
        };

        set({ activeGame: newState });

        // Sync initial state to client
        sendMessage(activeGame.clientId, {
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

      case "game_input": {
        // Received input from peer
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId || !myId) break;

        const game = gameRegistry.createInstance(activeGame.gameType);
        if (!game) break;

        const isHost = myId === activeGame.hostId;
        const input = message.input;

        // Apply input using BaseGame.handleInput
        let newState = game.handleInput(
          activeGame,
          input,
          message.playerId,
          isHost
        );

        // Check for game end (if game implements it)
        if (game.checkGameEnd) {
          const endResult = game.checkGameEnd(newState);
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

        // If we're the host, sync state back to client
        if (isHost) {
          sendMessage(activeGame.clientId, {
            type: "game_state_sync",
            sessionId: activeGame.id,
            state: newState,
          });
        }
        break;
      }

      case "game_state_sync": {
        // Received state sync from host (we are guest)
        const { activeGame } = state;
        if (!activeGame || activeGame.id !== message.sessionId) break;

        set({ activeGame: message.state });
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

        // Also remove from pending invites if it exists
        // This handles the case where host cancels before client accepts
        state.removePendingInvite(message.sessionId);
        break;
      }
    }
  },
}));
