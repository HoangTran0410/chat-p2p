const STORAGE_KEY_USER_ID = "synapse_user_id";

export const getStoredUserId = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_USER_ID);
};

export const storeUserId = (id: string): void => {
  localStorage.setItem(STORAGE_KEY_USER_ID, id);
};

// Word lists for readable ID generation
const ADJECTIVES = [
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
];

const NOUNS = [
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
];

// Generate short, readable, memorable IDs like "swift-tiger-42"
export const generateId = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
};
