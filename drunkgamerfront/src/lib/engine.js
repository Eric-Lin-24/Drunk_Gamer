// In-browser game engine. Ported from the old Lambda (backend/index.mjs) so the
// whole game runs on the phone. All functions are pure: they return a new game.

const RULE = /^(person|group)_round_based:(\d+)$/;

const defaultId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const defaults = { rand: Math.random, now: Date.now, makeId: defaultId };

export function newGame() {
  return { players: [], cardCounter: 0, currentRound: 1, activeRules: [], currentCard: null, deckOrder: null, deckPos: 0 };
}

export function addPlayer(game, name, id = defaultId()) {
  const clean = String(name ?? "").trim().slice(0, 24);
  if (!clean) return game;
  return { ...game, players: [...game.players, { id, name: clean }] };
}

export function removePlayer(game, id) {
  return { ...game, players: game.players.filter((p) => p.id !== id) };
}

export function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dealCard(game, cards, options = {}) {
  const { rand, now, makeId } = { ...defaults, ...options };
  const { players } = game;
  if (players.length < 1) throw new Error("Need at least 1 player");

  const ids = cards.map((c) => c.id);
  let deckOrder = game.deckOrder;
  let deckPos = game.deckPos || 0;
  const known = new Set(ids);
  const stale = !Array.isArray(deckOrder) || deckOrder.length !== ids.length || !deckOrder.every((id) => known.has(id));
  if (stale || deckPos >= deckOrder.length) {
    deckOrder = shuffle(ids, rand);
    deckPos = 0;
  }

  const c = cards.find((card) => card.id === deckOrder[deckPos]);
  const currentCard = { id: c.id, title: c.title, description: c.description, category: c.category || null, shownAt: now() };

  const dealt = Number(game.cardCounter || 0);
  const cardCounter = dealt + 1;
  const turn = dealt % players.length;
  const player = players[turn];
  let currentRound = Number(game.currentRound || 1);

  // The current player's own rules tick down as their turn comes round.
  let activeRules = (game.activeRules || [])
    .map((r) => (r.type === "person" && r.playerId === player.id ? { ...r, roundsRemaining: r.roundsRemaining - 1 } : r))
    .filter((r) => r.roundsRemaining > 0);

  // Everyone has had a turn: new round, group rules tick down.
  if (cardCounter % players.length === 0) {
    currentRound++;
    activeRules = activeRules
      .map((r) => (r.type === "group" ? { ...r, roundsRemaining: r.roundsRemaining - 1 } : r))
      .filter((r) => r.roundsRemaining > 0);
  }

  const rule = RULE.exec(c.category || "");
  if (rule) {
    const type = rule[1];
    activeRules = [...activeRules, {
      ruleId: makeId(),
      cardTitle: c.title,
      cardDescription: c.description,
      type,
      playerId: type === "person" ? player.id : null,
      playerName: type === "person" ? player.name : null,
      roundsRemaining: Number(rule[2]),
      addedInRound: currentRound,
    }];
  }

  return { ...game, deckOrder, deckPos: deckPos + 1, cardCounter, currentRound, activeRules, currentCard };
}
