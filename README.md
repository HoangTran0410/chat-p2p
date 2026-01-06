# Ping - P2P Chat

A secure, browser-to-browser chat application powered by WebRTC. No central server for messages - everything goes directly peer-to-peer.

## ✨ Features

- **🔐 End-to-End Encrypted** - Messages go directly between browsers via WebRTC
- **📁 File Sharing** - Send images, videos, and files (chunked transfer for large files)
- **📊 Progress Indicators** - Real-time progress for file transfers and history sync
- **💾 Local Storage** - Chats persisted in IndexedDB (auto-migrates from localStorage)
- **🔄 History Sync** - Merge chat history between devices with 2-way sync
- **⚙️ Configurable Server** - Customize PeerJS signaling server
- **📱 Mobile Responsive** - Works on desktop and mobile browsers
- **✅ Message Status** - Sent, Delivered, Read indicators with retry for failed messages

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build
```

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI Framework |
| TypeScript | Type Safety |
| Vite 6 | Bundler |
| PeerJS | WebRTC P2P |
| IndexedDB | Local Storage |
| Tailwind CSS | Styling |

## 📡 How It Works

1. **Signaling** - PeerJS server (`fbaio.xyz`) handles initial peer discovery
2. **Connection** - WebRTC establishes direct browser-to-browser link
3. **Key Exchange** - ECDH key exchange with ECDSA signatures
4. **Messaging** - All messages encrypted with AES-256-GCM
5. **Storage** - Chats saved locally in IndexedDB

## 🔐 End-to-End Encryption (E2EE)

All messages are encrypted using modern cryptographic standards. Even if someone intercepts the WebRTC traffic, they cannot read your messages.

### Cryptographic Algorithms

| Purpose | Algorithm | Details |
|---------|-----------|---------|
| **Identity Keys** | ECDSA (P-256) | Signs session keys to prove identity |
| **Key Exchange** | ECDH (P-256) | Derives shared secret between peers |
| **Key Derivation** | HKDF (SHA-256) | Converts ECDH output to AES key |
| **Message Encryption** | AES-256-GCM | Authenticated encryption with random IV |

### Key Exchange Flow

```
┌─────────────┐                           ┌─────────────┐
│   Peer A    │                           │   Peer B    │
└──────┬──────┘                           └──────┬──────┘
       │                                         │
       │  1. Generate Identity Key (ECDSA)       │
       │  2. Generate Session Key (ECDH)         │
       │                                         │
       │──── key_exchange ──────────────────────►│
       │     (identity_pub, session_pub,         │
       │      signature)                         │
       │                                         │
       │                           3. Verify signature
       │                           4. Generate own Session Key
       │                           5. Derive shared AES key
       │                                         │
       │◄──── key_exchange ─────────────────────│
       │                                         │
       │  6. Verify signature                    │
       │  7. Derive shared AES key               │
       │                                         │
       │◄═══════ E2EE Active ═══════════════════►│
       │                                         │
```

### Message Encryption

```
Plaintext Message
        │
        ▼
┌───────────────────┐
│ JSON.stringify()  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Generate 12-byte  │
│   random IV       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  AES-256-GCM      │
│  Encrypt          │
│  (key, iv, data)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ { type: "encrypted_message",
│   payload: {
│     iv: base64,
│     ciphertext: base64
│   }
│ }
└───────────────────┘
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Identity Verification** | Fingerprint display in Settings - compare with peer via trusted channel |
| **Key Change Detection** | Warning shown if peer's identity key changes (potential MITM) |
| **Forward Secrecy** | New session keys generated each app session |
| **Key Backup** | Export/import identity keys for account recovery |
| **Message Authentication** | GCM mode provides integrity + authenticity |

### File Locations

| File | Purpose |
|------|---------|
| `src/services/crypto.ts` | All cryptographic operations |
| `src/hooks/useEncryption.ts` | React hook for E2EE state management |
| `src/services/db.ts` | IndexedDB storage for identity & peer keys |
| `src/components/SecurityBadge.tsx` | UI components for encryption status |

## ⚠️ Limitations

- Both peers must be online to chat
- Large files (>50MB) may fail on slow connections
- NAT traversal depends on network configuration
- Max 50 simultaneous connections

## 📄 License

MIT
