# Chat P2P - Project Guide

## Overview
P2P chat app using PeerJS (WebRTC) for direct browser-to-browser messaging.

## Tech Stack
- React 19 + TypeScript
- Vite 6 + Bun
- PeerJS, IndexedDB, Tailwind CSS
- Icons: Lucide React, Dates: date-fns

## Project Structure
```
src/
├── App.tsx              # Main app, state management
├── types.ts             # TypeScript types
├── constants/index.ts   # PeerJS config defaults
├── components/
│   ├── ChatSidebar.tsx  # Sidebar, chat list, connection
│   ├── ChatWindow.tsx   # Chat UI, messages, file transfer
│   └── SettingsModal.tsx# PeerJS server config
├── hooks/
│   └── useP2P.ts        # PeerJS connection hook
└── services/
    ├── storage.ts       # User ID persistence
    └── db.ts            # IndexedDB for chats
```

## Commands
```bash
bun install    # Install deps
bun run dev    # Dev server
bun run build  # Production build
```

## Key Patterns

### State Management
- Chat sessions: `Record<string, ChatSession>` in App.tsx
- Persistence: IndexedDB via `db.ts`
- Connection states tracked in `useP2P` hook

### Message Types
- `text`, `image`, `video`, `file`
- Status: `sending`, `sent`, `delivered`, `read`, `failed`
- Large files use chunked transfer (64KB chunks)

### P2P Protocol
- `sync_request/reject/cancel` - History sync handshake
- `sync_data_initial/final` - 2-way sync data
- `file_start/chunk/end` - Chunked file transfer
- `receipt` - Delivery/read receipts
- `typing`, `presence` - Status updates

### Connection Limits
- Max 50 connections (configurable in `useP2P.ts`)
- Oldest auto-disconnects when limit exceeded

## Config
PeerJS server settings in localStorage (`peer_config`):
- Default: `fbaio.xyz:443/peer` (secure)
- Editable via Settings modal

## Build Output
- HTML: `index.html`
- Assets: `public/`
- Code-split: vendor, components, services
