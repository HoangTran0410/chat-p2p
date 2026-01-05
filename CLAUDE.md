# Chat P2P - Project Guide

## Overview
A peer-to-peer chat application using PeerJS for real-time browser-to-browser communication without a central server.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 6
- **Package Manager**: Bun
- **P2P**: PeerJS (WebRTC-based)
- **Icons**: Lucide React
- **Date Utils**: date-fns

## Project Structure
```
src/
├── App.tsx           # Main app component with chat logic
├── index.tsx         # Entry point
├── index.html        # HTML template
├── types.ts          # TypeScript type definitions
├── components/
│   ├── ChatSidebar.tsx   # Sidebar with chat list & connection UI
│   └── ChatWindow.tsx    # Main chat interface
├── hooks/
│   └── useP2P.ts     # PeerJS hook for P2P communication
└── services/
    └── storage.ts    # LocalStorage persistence for chats
```

## Commands
```bash
bun install      # Install dependencies
bun run dev      # Start dev server (port 3000)
bun run build    # Build for production
bun run preview  # Preview production build
```

## Key Patterns

### State Management
- Chat sessions stored in React state + localStorage
- P2P connection state managed via `useP2P` hook

### P2P Communication
- Uses PeerJS for WebRTC connections
- Each user gets a unique peer ID on connection
- Messages sent directly between peers

### Styling
- Inline styles and CSS-in-JS patterns
- Dark theme with gradient backgrounds
- Mobile-responsive design

## Environment Variables
Set in `.env.local`:
- `GEMINI_API_KEY` - For AI features (optional)

## Path Aliases
- `@/*` → maps to project root

## Build Output
- Production builds output to root directory
- Assets placed in `public/` folder
- Vendor code split into separate chunks
