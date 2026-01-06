/**
 * E2EE Crypto Service
 *
 * Uses Web Crypto API for:
 * - ECDSA (P-256): Identity key pairs for signing/verification
 * - ECDH (P-256): Session key pairs for key exchange
 * - AES-256-GCM: Message encryption/decryption
 * - HKDF: Key derivation from ECDH shared secret
 */

// ==================== Types ====================

export interface IdentityKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface SessionKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedPayload {
  iv: string; // Base64 encoded IV (12 bytes for GCM)
  ciphertext: string; // Base64 encoded ciphertext + auth tag
}

export interface ExportedKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

// ==================== Constants ====================

const ECDSA_PARAMS: EcKeyGenParams = {
  name: "ECDSA",
  namedCurve: "P-256",
};

const ECDH_PARAMS: EcKeyGenParams = {
  name: "ECDH",
  namedCurve: "P-256",
};

const AES_PARAMS = {
  name: "AES-GCM",
  length: 256,
};

// ==================== Key Generation ====================

/**
 * Generate an ECDSA key pair for identity (signing/verification)
 */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    ECDSA_PARAMS,
    true, // extractable for export
    ["sign", "verify"]
  );
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Generate an ECDH key pair for session (key exchange)
 */
export async function generateSessionKeyPair(): Promise<SessionKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    ECDH_PARAMS,
    true, // extractable for export
    ["deriveKey", "deriveBits"]
  );
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

// ==================== Key Exchange (ECDH) ====================

/**
 * Derive a shared AES key from ECDH key exchange
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  // First derive bits using ECDH
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    myPrivateKey,
    256 // P-256 gives us 256 bits
  );

  // Import as raw key for HKDF
  const sharedKeyMaterial = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  // Derive AES key using HKDF
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("chat-p2p-e2ee-v1"),
      info: new TextEncoder().encode("aes-key"),
    },
    sharedKeyMaterial,
    AES_PARAMS,
    true, // extractable for potential future use
    ["encrypt", "decrypt"]
  );

  return aesKey;
}

// ==================== Encryption/Decryption ====================

/**
 * Encrypt a message using AES-256-GCM
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt a message using AES-256-GCM
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const iv = base64ToArrayBuffer(payload.iv);
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ==================== Signing/Verification ====================

/**
 * Sign data using ECDSA private key
 */
export async function signData(
  data: ArrayBuffer | string,
  privateKey: CryptoKey
): Promise<string> {
  const dataBuffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data;

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    dataBuffer
  );

  return arrayBufferToBase64(signature);
}

/**
 * Verify signature using ECDSA public key
 */
export async function verifySignature(
  data: ArrayBuffer | string,
  signature: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const dataBuffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const signatureBuffer = base64ToArrayBuffer(signature);

  try {
    return await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-256",
      },
      publicKey,
      signatureBuffer,
      dataBuffer
    );
  } catch {
    return false;
  }
}

// ==================== Fingerprint ====================

/**
 * Generate a fingerprint (SHA-256 hash) of a public key
 * Returns a hex string that can be displayed to users
 */
export async function getFingerprint(publicKey: CryptoKey): Promise<string> {
  // Export key to get consistent representation
  const exported = await crypto.subtle.exportKey("raw", publicKey);

  // Hash it
  const hash = await crypto.subtle.digest("SHA-256", exported);

  // Convert to hex
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format as groups of 4 for readability (like: "a1b2 c3d4 e5f6 ...")
  return hashHex.match(/.{1,4}/g)?.join(" ") || hashHex;
}

/**
 * Generate a short fingerprint (first 16 chars) for display in UI
 */
export async function getShortFingerprint(
  publicKey: CryptoKey
): Promise<string> {
  const full = await getFingerprint(publicKey);
  // Take first 4 groups (16 hex chars + 3 spaces)
  return full.split(" ").slice(0, 4).join(" ");
}

// ==================== Key Export/Import ====================

/**
 * Export a key pair to JWK format for backup
 */
export async function exportKeyPair(
  keyPair: IdentityKeyPair | SessionKeyPair
): Promise<ExportedKeyPair> {
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return { publicKey, privateKey };
}

/**
 * Export only public key to JWK for sharing
 */
export async function exportPublicKey(
  publicKey: CryptoKey
): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", publicKey);
}

/**
 * Import an identity key pair from JWK format
 */
export async function importIdentityKeyPair(
  exported: ExportedKeyPair
): Promise<IdentityKeyPair> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    exported.publicKey,
    ECDSA_PARAMS,
    true,
    ["verify"]
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    exported.privateKey,
    ECDSA_PARAMS,
    true,
    ["sign"]
  );
  return { publicKey, privateKey };
}

/**
 * Import a session key pair from JWK format
 */
export async function importSessionKeyPair(
  exported: ExportedKeyPair
): Promise<SessionKeyPair> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    exported.publicKey,
    ECDH_PARAMS,
    true,
    []
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    exported.privateKey,
    ECDH_PARAMS,
    true,
    ["deriveKey", "deriveBits"]
  );
  return { publicKey, privateKey };
}

/**
 * Import a peer's public identity key from JWK
 */
export async function importPeerIdentityKey(
  jwk: JsonWebKey
): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDSA_PARAMS, true, ["verify"]);
}

/**
 * Import a peer's public session key from JWK
 */
export async function importPeerSessionKey(
  jwk: JsonWebKey
): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, true, []);
}

// ==================== Utilities ====================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==================== High-level helpers ====================

/**
 * Create a signed key exchange message
 */
export async function createKeyExchangePayload(
  identityKeyPair: IdentityKeyPair,
  sessionKeyPair: SessionKeyPair
): Promise<{
  identityPubKey: JsonWebKey;
  sessionPubKey: JsonWebKey;
  signature: string;
}> {
  const identityPubKey = await exportPublicKey(identityKeyPair.publicKey);
  const sessionPubKey = await exportPublicKey(sessionKeyPair.publicKey);

  // Sign the session public key with identity private key
  const sessionPubKeyStr = JSON.stringify(sessionPubKey);
  const signature = await signData(
    sessionPubKeyStr,
    identityKeyPair.privateKey
  );

  return {
    identityPubKey,
    sessionPubKey,
    signature,
  };
}

/**
 * Verify and parse a key exchange message from peer
 */
export async function verifyKeyExchangePayload(payload: {
  identityPubKey: JsonWebKey;
  sessionPubKey: JsonWebKey;
  signature: string;
}): Promise<{
  valid: boolean;
  identityKey?: CryptoKey;
  sessionKey?: CryptoKey;
  fingerprint?: string;
}> {
  try {
    // Import peer's identity key
    const identityKey = await importPeerIdentityKey(payload.identityPubKey);

    // Verify the signature of session key
    const sessionPubKeyStr = JSON.stringify(payload.sessionPubKey);
    const valid = await verifySignature(
      sessionPubKeyStr,
      payload.signature,
      identityKey
    );

    if (!valid) {
      return { valid: false };
    }

    // Import session key
    const sessionKey = await importPeerSessionKey(payload.sessionPubKey);
    const fingerprint = await getFingerprint(identityKey);

    return {
      valid: true,
      identityKey,
      sessionKey,
      fingerprint,
    };
  } catch (error) {
    console.error("Key exchange verification failed:", error);
    return { valid: false };
  }
}
