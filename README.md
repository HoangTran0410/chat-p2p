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
3. **Messaging** - All data transferred directly between peers
4. **Storage** - Chats saved locally in IndexedDB

## ⚠️ Limitations

- Both peers must be online to chat
- Large files (>50MB) may fail on slow connections
- NAT traversal depends on network configuration
- Max 50 simultaneous connections

## 📄 License

MIT
