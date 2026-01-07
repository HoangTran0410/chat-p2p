export function createInviteLink(peerId: string) {
  return `${window.location.origin}${window.location.pathname}#connect=${peerId}`;
}

export function parseUrlHash() {
  const hash = window.location.hash;
  let pendingConnect: string | null = null;

  if (hash.startsWith("#connect=")) {
    pendingConnect = hash.slice(9);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }

  return { pendingConnect };
}
