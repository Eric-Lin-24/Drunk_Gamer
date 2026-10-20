export function playerId(p) {
  return p.id || p.playerId;
}

export function playersInGame(room) {
  return (room?.players || []).filter((p) => p.name !== "Host");
}

// cardCounter is how many cards have been dealt; card N belongs to player (N-1) % count.
export function turnIndex(playerCount, cardCounter) {
  const dealt = Number(cardCounter || 0);
  if (!playerCount || dealt <= 0) return 0;
  return (dealt - 1) % playerCount;
}

// Round of the card on screen (the engine's counter ticks over as the last player's card is dealt).
export function roundOf(playerCount, cardCounter) {
  const dealt = Number(cardCounter || 0);
  if (!playerCount || dealt <= 0) return 1;
  return Math.floor((dealt - 1) / playerCount) + 1;
}

export function rulesForPlayer(activeRules, id) {
  return (activeRules || []).filter((r) => r.type === "person" && r.playerId === id);
}

export function groupRules(activeRules) {
  return (activeRules || []).filter((r) => r.type === "group");
}
