import { ChatSession, StoredIdentityKeys, PeerKeyInfo } from "../types";

// Add to existing imports/constants if needed, or just append the function
const DB_NAME = "ChatP2P_v2"; // Version bump for session support
const STORE_NAME = "chat_sessions";
const IDENTITY_KEYS_STORE = "identity_keys";
const PEER_KEYS_STORE = "peer_keys";
const VERSION = 2; // Bumped for E2EE support

// Internal storage type with session info
interface StoredChatSession extends ChatSession {
  sessionId: string; // The user's session ID (my ID)
  _key: string; // Compound key: sessionId_peerId
}

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Chat sessions store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "_key" });
        // Index by sessionId for efficient queries
        store.createIndex("sessionId", "sessionId", { unique: false });
      }

      // Identity keys store (one per session)
      if (!db.objectStoreNames.contains(IDENTITY_KEYS_STORE)) {
        db.createObjectStore(IDENTITY_KEYS_STORE, { keyPath: "sessionId" });
      }

      // Peer keys store (track peer identity keys)
      if (!db.objectStoreNames.contains(PEER_KEYS_STORE)) {
        const peerStore = db.createObjectStore(PEER_KEYS_STORE, {
          keyPath: "peerId",
        });
        peerStore.createIndex("fingerprint", "fingerprint", { unique: false });
      }
    };

    request.onsuccess = async () => {
      resolve();
    };
  });
};

export const saveChatToDB = (
  sessionId: string,
  session: ChatSession
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const storedSession: StoredChatSession = {
        ...session,
        sessionId,
        _key: `${sessionId}_${session.peerId}`,
      };

      const putRequest = store.put(storedSession);

      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = () => {
        db.close();
        reject(putRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const getAllChatsFromDB = (
  sessionId: string
): Promise<Record<string, ChatSession>> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = async () => {
      const db = request.result;

      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("sessionId");
      const getAllRequest = index.getAll(sessionId);

      getAllRequest.onsuccess = () => {
        const sessions = getAllRequest.result as StoredChatSession[];
        const chatMap: Record<string, ChatSession> = {};

        sessions.forEach((session) => {
          // Extract the original ChatSession (without internal fields)
          const { sessionId: _sid, _key, ...chatSession } = session;
          chatMap[chatSession.peerId] = chatSession;
        });

        db.close();
        resolve(chatMap);
      };

      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const deleteChatFromDB = (
  sessionId: string,
  peerId: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const key = `${sessionId}_${peerId}`;
      const deleteRequest = store.delete(key);

      deleteRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      deleteRequest.onerror = () => {
        db.close();
        reject(deleteRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

// Delete all chats for a session
export const deleteAllChatsForSession = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("sessionId");
      const getAllRequest = index.getAllKeys(sessionId);

      getAllRequest.onsuccess = () => {
        const keys = getAllRequest.result;
        let remaining = keys.length;

        if (remaining === 0) {
          db.close();
          resolve();
          return;
        }

        keys.forEach((key) => {
          const deleteRequest = store.delete(key);
          deleteRequest.onsuccess = () => {
            remaining--;
            if (remaining === 0) {
              db.close();
              resolve();
            }
          };
          deleteRequest.onerror = () => {
            db.close();
            reject(deleteRequest.error);
          };
        });
      };

      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const clearDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("Database deletion blocked");
      // Still reject or handle? Usually reload fixes this, but let's reject for now
      reject(new Error("Database deletion blocked"));
    };
  });
};

// ==================== Identity Keys ====================

export const saveIdentityKeys = (keys: StoredIdentityKeys): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(IDENTITY_KEYS_STORE, "readwrite");
      const store = transaction.objectStore(IDENTITY_KEYS_STORE);

      const putRequest = store.put(keys);

      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = () => {
        db.close();
        reject(putRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const getIdentityKeys = (
  sessionId: string
): Promise<StoredIdentityKeys | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(IDENTITY_KEYS_STORE, "readonly");
      const store = transaction.objectStore(IDENTITY_KEYS_STORE);

      const getRequest = store.get(sessionId);

      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

// ==================== Peer Keys ====================

export const savePeerKey = (peerKey: PeerKeyInfo): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(PEER_KEYS_STORE, "readwrite");
      const store = transaction.objectStore(PEER_KEYS_STORE);

      const putRequest = store.put(peerKey);

      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = () => {
        db.close();
        reject(putRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const getPeerKey = (peerId: string): Promise<PeerKeyInfo | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(PEER_KEYS_STORE, "readonly");
      const store = transaction.objectStore(PEER_KEYS_STORE);

      const getRequest = store.get(peerId);

      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const getAllPeerKeys = (): Promise<PeerKeyInfo[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(PEER_KEYS_STORE, "readonly");
      const store = transaction.objectStore(PEER_KEYS_STORE);

      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result || []);
      };
      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const deletePeerKey = (peerId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(PEER_KEYS_STORE, "readwrite");
      const store = transaction.objectStore(PEER_KEYS_STORE);

      const deleteRequest = store.delete(peerId);

      deleteRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      deleteRequest.onerror = () => {
        db.close();
        reject(deleteRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};
