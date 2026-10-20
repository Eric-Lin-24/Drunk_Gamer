import { useEffect, useState } from "react";
import cards from "../data/cards.json";
import { addPlayer, dealCard, newGame, removePlayer } from "../lib/engine.js";

const KEY = "drunkgamer:game";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved?.players ? saved : null;
  } catch {
    return null;
  }
}

function save(game) {
  try {
    game ? localStorage.setItem(KEY, JSON.stringify(game)) : localStorage.removeItem(KEY);
  } catch { /* storage unavailable: game still works for this session */ }
}

// Game state lives on this device; a saved game resumes after a reload.
export function useGame() {
  const [game, setGame] = useState(load);
  const [error, setError] = useState("");

  useEffect(() => save(game), [game]);

  const screen = !game ? "start" : game.currentCard ? "game" : "lobby";

  // Compute outside the state updater so engine errors are caught here and
  // StrictMode's double-invoked updaters can't deal two different cards.
  const update = (fn) => {
    setError("");
    try {
      setGame(fn(game));
    } catch (e) {
      setError(e.message);
    }
  };

  return {
    screen,
    game,
    players: game?.players || [],
    error,
    start: () => update(() => newGame()),
    addPlayer: (name) => {
      if (!name.trim()) return false;
      update((g) => addPlayer(g, name));
      return true;
    },
    removePlayer: (id) => update((g) => removePlayer(g, id)),
    nextCard: () => {
      if (!game?.players.length) return setError("Add at least one player first.");
      update((g) => dealCard(g, cards));
    },
    reset: () => update(() => null),
  };
}
