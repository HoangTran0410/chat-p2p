import { ChatSession } from "../types";

const DB_NAME = "ChatP2P_v1";
const STORE_NAME = "chat_sessions";
const VERSION = 1;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "peerId" });
      }
    };

    request.onsuccess = async () => {
      // Check for migration
      await migrateFromLocalStorage();
      resolve();
    };
  });
};

const migrateFromLocalStorage = async (): Promise<void> => {
  const STORAGE_KEY = "synapse_chats";
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) return;

  try {
    const chats = JSON.parse(data) as Record<string, ChatSession>;
    console.log("Migrating chats to IndexedDB...", Object.keys(chats).length);

    await Promise.all(
      Object.values(chats).map((session) => saveChatToDB(session))
    );

    localStorage.removeItem(STORAGE_KEY);
    console.log("Migration complete. LocalStorage cleared.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
};

export const saveChatToDB = (session: ChatSession): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(session);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
};

export const getAllChatsFromDB = (): Promise<Record<string, ChatSession>> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const sessions = getAllRequest.result as ChatSession[];
        const chatMap: Record<string, ChatSession> = {};
        sessions.forEach((session) => {
          chatMap[session.peerId] = session;
        });
        resolve(chatMap);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
};

export const deleteChatFromDB = (peerId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const deleteRequest = store.delete(peerId);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
};
