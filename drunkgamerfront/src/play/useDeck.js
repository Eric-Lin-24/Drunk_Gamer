import { useEffect, useMemo, useState } from "react";
import baseCards from "../data/cards.json";
import { buildDeck, deckRows, deleteCard, emptyDeckEdits, restoreCard, saveCard, setCopies } from "../lib/deck.js";

const KEY = "drunkgamer:deck";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.copies && saved?.edits && Array.isArray(saved?.custom)) return saved;
  } catch { /* fall through to default */ }
  return emptyDeckEdits();
}

// This device's deck: copies per card, reworded built-ins and custom cards.
export function useDeck() {
  const [edits, setEdits] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch { /* storage unavailable */ }
  }, [edits]);

  const rows = useMemo(() => deckRows(baseCards, edits), [edits]);
  const cards = useMemo(() => buildDeck(rows), [rows]);

  return {
    rows,
    cards,
    unique: rows.filter((r) => r.copies > 0).length,
    setCopies: (id, n) => {
      const card = rows.find((r) => r.card.id === id)?.card;
      setEdits((e) => setCopies(e, id, n, card?.copies ?? 1));
    },
    save: (draft) => setEdits(saveCard(baseCards, edits, draft)),
    restore: (id) => setEdits((e) => restoreCard(e, id)),
    remove: (id) => setEdits((e) => deleteCard(e, id)),
    reset: () => setEdits(emptyDeckEdits()),
  };
}
