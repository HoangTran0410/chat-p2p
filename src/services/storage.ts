const STORAGE_KEY_USER_ID = "synapse_user_id";

export const getStoredUserId = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_USER_ID);
};

export const storeUserId = (id: string): void => {
  localStorage.setItem(STORAGE_KEY_USER_ID, id);
};

const ADJECTIVES = [
  // Cũ
  "swift",
  "brave",
  "calm",
  "cool",
  "quick",
  "bold",
  "wise",
  "keen",
  "wild",
  "free",
  "pure",
  "deep",
  "warm",
  "soft",
  "fair",
  "true",
  "glad",
  "kind",
  "neat",
  "rich",
  "safe",
  "slim",
  "tall",
  "fast",
  // Mới: Trạng thái & Tính chất
  "bright",
  "dark",
  "sharp",
  "smooth",
  "grand",
  "proud",
  "vivid",
  "silent",
  "lucky",
  "heavy",
  "light",
  "fresh",
  "mighty",
  "gentle",
  "fancy",
  "tough",
  "loyal",
  "quiet",
  "smart",
  "super",
  "eager",
  "jolly",
  "crisp",
  "sturdy",
  "noble",
  "brisk",
  "dandy",
  "fancy",
  "flat",
  "glossy",
  "good",
  "grand",
  "great",
  "handy",
  "happy",
  "hardy",
  "huge",
  "lean",
  "long",
  "lost",
  // Mới: Màu sắc & Cảm giác
  "red",
  "blue",
  "green",
  "gold",
  "silver",
  "pink",
  "gray",
  "white",
  "black",
  "azure",
  "amber",
  "blind",
  "busy",
  "cheap",
  "chief",
  "clean",
  "close",
  "crazy",
  "curly",
  "cute",
  "daft",
  "dear",
  "dirty",
  "dry",
  "easy",
  "extra",
  "fair",
  "fine",
  "firm",
  "flat",
  "full",
  "funny",
  "good",
  "grey",
  "grim",
  "half",
  "hard",
  "high",
  "holy",
  "hot",
];

const NOUNS = [
  // Cũ
  "tiger",
  "wave",
  "star",
  "wind",
  "hawk",
  "wolf",
  "bear",
  "lake",
  "moon",
  "fire",
  "snow",
  "leaf",
  "rain",
  "rock",
  "rose",
  "tree",
  "bird",
  "fish",
  "frog",
  "deer",
  "dove",
  "fox",
  "owl",
  "seal",
  // Mới: Động vật & Sinh vật
  "eagle",
  "lion",
  "lynx",
  "orca",
  "panda",
  "crane",
  "swan",
  "falcon",
  "whale",
  "shark",
  "horse",
  "mouse",
  "snake",
  "goat",
  "lamb",
  "duck",
  "goose",
  "crab",
  "ant",
  "bee",
  "wasp",
  "moth",
  "slug",
  "snail",
  "stork",
  "crow",
  "raven",
  "robin",
  "finch",
  "cricket",
  // Mới: Thiên nhiên & Địa lý
  "ocean",
  "mount",
  "river",
  "cloud",
  "desert",
  "forest",
  "valley",
  "peak",
  "cliff",
  "dune",
  "field",
  "glade",
  "grove",
  "island",
  "marsh",
  "meadow",
  "pond",
  "reef",
  "shore",
  "spring",
  "stone",
  "brook",
  "creek",
  "bench",
  "bridge",
  "gate",
  "path",
  "road",
  "stone",
  "wall",
  // Mới: Vũ trụ & Khác
  "sun",
  "mars",
  "sky",
  "comet",
  "nova",
  "dust",
  "gem",
  "iron",
  "gold",
  "silk",
  "steel",
  "zinc",
  "bolt",
  "beam",
  "ray",
  "zone",
  "space",
  "orbit",
  "path",
  "way",
];

// Generate short, readable, memorable IDs like "swift-tiger-42"
export const generateId = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}-${noun}-${num}`;
};

// ==================== Session Management ====================

import { UserSession } from "../types";

const STORAGE_KEY_SESSIONS = "synapse_sessions";
const STORAGE_KEY_ACTIVE_SESSION = "synapse_active_session";

export const getStoredSessions = (): UserSession[] => {
  const data = localStorage.getItem(STORAGE_KEY_SESSIONS);
  if (!data) return [];
  try {
    return JSON.parse(data) as UserSession[];
  } catch {
    return [];
  }
};

export const storeSession = (session: UserSession): void => {
  const sessions = getStoredSessions();
  // Check if session already exists (by id)
  const existingIndex = sessions.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
};

export const deleteSession = (sessionId: string): void => {
  const sessions = getStoredSessions().filter((s) => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
};

export const getActiveSessionId = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
};

export const setActiveSessionId = (sessionId: string): void => {
  localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, sessionId);
};
