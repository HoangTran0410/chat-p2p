export function createInviteLink(peerId: string) {
  return `${window.location.origin}${window.location.pathname}#connect=${peerId}`;
}

export function createInviteRoomLink(roomId: string) {
  return `${window.location.origin}${window.location.pathname}#room=${roomId}`;
}

export function parseUrlHash() {
  const hash = window.location.hash;
  let pendingConnect: string | null = null;
  let pendingRoom: string | null = null;

  if (hash.startsWith("#connect=")) {
    pendingConnect = hash.slice(9);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  } else if (hash.startsWith("#room=")) {
    pendingRoom = hash.slice(6);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }

  return { pendingConnect, pendingRoom };
}
