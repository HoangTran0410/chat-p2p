/**
 * useEncryption Hook
 *
 * Manages E2EE state including:
 * - Identity key pair initialization and storage
 * - Per-peer session keys and encryption state
 * - Key exchange protocol handling
 * - Fingerprint tracking and key change detection
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  generateIdentityKeyPair,
  generateSessionKeyPair,
  createKeyExchangePayload,
  verifyKeyExchangePayload,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  exportKeyPair,
  importIdentityKeyPair,
  getFingerprint,
  getShortFingerprint,
  IdentityKeyPair,
  SessionKeyPair,
  EncryptedPayload,
} from "../services/crypto";
import {
  saveIdentityKeys,
  getIdentityKeys,
  savePeerKey,
  getPeerKey,
} from "../services/db";
import { StoredIdentityKeys, PeerKeyInfo } from "../types";

interface PeerEncryptionState {
  sessionKey: CryptoKey | null;
  fingerprint: string;
  verified: boolean;
  keyChanged: boolean; // true if key differs from stored
}

interface UseEncryptionProps {
  sessionId: string;
  onKeyChange?: (
    peerId: string,
    oldFingerprint: string,
    newFingerprint: string
  ) => void;
}

interface UseEncryptionReturn {
  isReady: boolean;
  myFingerprint: string | null;
  myShortFingerprint: string | null;
  identityKeyPair: IdentityKeyPair | null;
  sessionKeyPair: SessionKeyPair | null;
  peerStates: Map<string, PeerEncryptionState>;

  // Key exchange
  createKeyExchange: () => Promise<{
    identityPubKey: JsonWebKey;
    sessionPubKey: JsonWebKey;
    signature: string;
  } | null>;
  handleKeyExchange: (
    peerId: string,
    payload: {
      identityPubKey: JsonWebKey;
      sessionPubKey: JsonWebKey;
      signature: string;
    }
  ) => Promise<boolean>;

  // Encryption/Decryption
  encrypt: (
    peerId: string,
    plaintext: string
  ) => Promise<EncryptedPayload | null>;
  decrypt: (
    peerId: string,
    payload: EncryptedPayload
  ) => Promise<string | null>;

  // Key management
  getPeerFingerprint: (peerId: string) => string | null;
  hasPeerKey: (peerId: string) => boolean;
  markPeerVerified: (peerId: string) => Promise<void>;

  // Export/Import
  exportMyKeys: () => Promise<string | null>;
  importMyKeys: (jsonStr: string) => Promise<boolean>;

  // Regenerate session key (for forward secrecy)
  regenerateSessionKey: () => Promise<void>;
}

export function useEncryption({
  sessionId,
  onKeyChange,
}: UseEncryptionProps): UseEncryptionReturn {
  const [isReady, setIsReady] = useState(false);
  const [myFingerprint, setMyFingerprint] = useState<string | null>(null);
  const [myShortFingerprint, setMyShortFingerprint] = useState<string | null>(
    null
  );

  const identityKeyPairRef = useRef<IdentityKeyPair | null>(null);
  const sessionKeyPairRef = useRef<SessionKeyPair | null>(null);
  const peerStatesRef = useRef<Map<string, PeerEncryptionState>>(new Map());

  // Force re-render when peer states change
  const [, forceUpdate] = useState({});
  const updatePeerStates = useCallback(() => forceUpdate({}), []);

  // Initialize identity keys
  useEffect(() => {
    if (!sessionId) return;

    const init = async () => {
      try {
        // Try to load existing identity keys
        const stored = await getIdentityKeys(sessionId);

        if (stored) {
          // Import existing keys
          const keyPair = await importIdentityKeyPair({
            publicKey: stored.identityPubKey,
            privateKey: stored.identityPrivKey,
          });
          identityKeyPairRef.current = keyPair;
        } else {
          // Generate new identity keys
          const keyPair = await generateIdentityKeyPair();
          identityKeyPairRef.current = keyPair;

          // Store them
          const exported = await exportKeyPair(keyPair);
          const toStore: StoredIdentityKeys = {
            sessionId,
            identityPubKey: exported.publicKey,
            identityPrivKey: exported.privateKey,
            createdAt: Date.now(),
          };
          await saveIdentityKeys(toStore);
        }

        // Generate session key pair (new for each app session for forward secrecy)
        sessionKeyPairRef.current = await generateSessionKeyPair();

        // Calculate fingerprints
        const fp = await getFingerprint(identityKeyPairRef.current.publicKey);
        const shortFp = await getShortFingerprint(
          identityKeyPairRef.current.publicKey
        );
        setMyFingerprint(fp);
        setMyShortFingerprint(shortFp);

        setIsReady(true);
      } catch (error) {
        console.error("Failed to initialize encryption:", error);
      }
    };

    init();
  }, [sessionId]);

  // Create key exchange payload
  const createKeyExchange = useCallback(async () => {
    if (!identityKeyPairRef.current || !sessionKeyPairRef.current) {
      return null;
    }

    return createKeyExchangePayload(
      identityKeyPairRef.current,
      sessionKeyPairRef.current
    );
  }, []);

  // Handle incoming key exchange
  const handleKeyExchange = useCallback(
    async (
      peerId: string,
      payload: {
        identityPubKey: JsonWebKey;
        sessionPubKey: JsonWebKey;
        signature: string;
      }
    ): Promise<boolean> => {
      if (!sessionKeyPairRef.current) {
        return false;
      }

      try {
        // Verify the key exchange
        const result = await verifyKeyExchangePayload(payload);

        if (!result.valid || !result.sessionKey || !result.fingerprint) {
          console.warn("Invalid key exchange from", peerId);
          return false;
        }

        // Derive shared key
        const sharedKey = await deriveSharedKey(
          sessionKeyPairRef.current.privateKey,
          result.sessionKey
        );

        // Check if we have a stored key for this peer
        const storedPeerKey = await getPeerKey(peerId);
        let keyChanged = false;

        if (storedPeerKey && storedPeerKey.fingerprint !== result.fingerprint) {
          keyChanged = true;
          if (onKeyChange) {
            onKeyChange(peerId, storedPeerKey.fingerprint, result.fingerprint);
          }
        }

        // Update peer state
        peerStatesRef.current.set(peerId, {
          sessionKey: sharedKey,
          fingerprint: result.fingerprint,
          verified: storedPeerKey?.verified || false,
          keyChanged,
        });

        // Store/update peer key info
        const peerKeyInfo: PeerKeyInfo = {
          peerId,
          identityPubKey: payload.identityPubKey,
          fingerprint: result.fingerprint,
          firstSeen: storedPeerKey?.firstSeen || Date.now(),
          lastSeen: Date.now(),
          verified: storedPeerKey?.verified || false,
        };
        await savePeerKey(peerKeyInfo);

        updatePeerStates();
        return true;
      } catch (error) {
        console.error("Key exchange failed:", error);
        return false;
      }
    },
    [onKeyChange, updatePeerStates]
  );

  // Encrypt message
  const encrypt = useCallback(
    async (
      peerId: string,
      plaintext: string
    ): Promise<EncryptedPayload | null> => {
      const peerState = peerStatesRef.current.get(peerId);
      if (!peerState?.sessionKey) {
        console.warn("No session key for peer:", peerId);
        return null;
      }

      try {
        return await encryptMessage(plaintext, peerState.sessionKey);
      } catch (error) {
        console.error("Encryption failed:", error);
        return null;
      }
    },
    []
  );

  // Decrypt message
  const decrypt = useCallback(
    async (
      peerId: string,
      payload: EncryptedPayload
    ): Promise<string | null> => {
      const peerState = peerStatesRef.current.get(peerId);
      if (!peerState?.sessionKey) {
        console.warn("No session key for peer:", peerId);
        return null;
      }

      try {
        return await decryptMessage(payload, peerState.sessionKey);
      } catch (error) {
        console.error("Decryption failed:", error);
        return null;
      }
    },
    []
  );

  // Get peer fingerprint
  const getPeerFingerprint = useCallback((peerId: string): string | null => {
    return peerStatesRef.current.get(peerId)?.fingerprint || null;
  }, []);

  // Check if we have encryption with peer
  const hasPeerKey = useCallback((peerId: string): boolean => {
    return (
      peerStatesRef.current.has(peerId) &&
      peerStatesRef.current.get(peerId)?.sessionKey !== null
    );
  }, []);

  // Mark peer as verified
  const markPeerVerified = useCallback(
    async (peerId: string): Promise<void> => {
      const peerState = peerStatesRef.current.get(peerId);
      if (!peerState) return;

      peerState.verified = true;
      peerState.keyChanged = false;

      // Update in DB
      const stored = await getPeerKey(peerId);
      if (stored) {
        stored.verified = true;
        await savePeerKey(stored);
      }

      updatePeerStates();
    },
    [updatePeerStates]
  );

  // Export my keys for backup
  const exportMyKeys = useCallback(async (): Promise<string | null> => {
    if (!identityKeyPairRef.current) return null;

    try {
      const exported = await exportKeyPair(identityKeyPairRef.current);
      return JSON.stringify(
        {
          sessionId,
          keys: exported,
          exportedAt: Date.now(),
        },
        null,
        2
      );
    } catch (error) {
      console.error("Failed to export keys:", error);
      return null;
    }
  }, [sessionId]);

  // Import keys from backup
  const importMyKeys = useCallback(
    async (jsonStr: string): Promise<boolean> => {
      try {
        const data = JSON.parse(jsonStr);
        if (!data.keys?.publicKey || !data.keys?.privateKey) {
          throw new Error("Invalid key format");
        }

        const keyPair = await importIdentityKeyPair(data.keys);
        identityKeyPairRef.current = keyPair;

        // Store them
        const toStore: StoredIdentityKeys = {
          sessionId,
          identityPubKey: data.keys.publicKey,
          identityPrivKey: data.keys.privateKey,
          createdAt: data.exportedAt || Date.now(),
        };
        await saveIdentityKeys(toStore);

        // Update fingerprints
        const fp = await getFingerprint(keyPair.publicKey);
        const shortFp = await getShortFingerprint(keyPair.publicKey);
        setMyFingerprint(fp);
        setMyShortFingerprint(shortFp);

        // Regenerate session key
        sessionKeyPairRef.current = await generateSessionKeyPair();

        return true;
      } catch (error) {
        console.error("Failed to import keys:", error);
        return false;
      }
    },
    [sessionId]
  );

  // Regenerate session key
  const regenerateSessionKey = useCallback(async (): Promise<void> => {
    sessionKeyPairRef.current = await generateSessionKeyPair();
    // Note: Peer connections will need to re-exchange keys
    peerStatesRef.current.clear();
    updatePeerStates();
  }, [updatePeerStates]);

  return {
    isReady,
    myFingerprint,
    myShortFingerprint,
    identityKeyPair: identityKeyPairRef.current,
    sessionKeyPair: sessionKeyPairRef.current,
    peerStates: peerStatesRef.current,
    createKeyExchange,
    handleKeyExchange,
    encrypt,
    decrypt,
    getPeerFingerprint,
    hasPeerKey,
    markPeerVerified,
    exportMyKeys,
    importMyKeys,
    regenerateSessionKey,
  };
}
