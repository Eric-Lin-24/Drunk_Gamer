// Deck editing: combines the built-in cards with this device's edits
// (copies per card, reworded built-ins, custom cards). Pure functions.

const RULE = /^(person|group)_round_based:(\d+)$/;

export const MAX_COPIES = 5;
export const KINDS = ["chaos", "dare", "truth", "opinion", "power"];
export const LIMITS = { title: 40, description: 160 };

const defaultId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const isCustom = (id) => typeof id === "string" && id.startsWith("c-");

export function emptyDeckEdits() {
  return { copies: {}, edits: {}, custom: [] };
}

export function parseCategory(category) {
  const rule = RULE.exec(category || "");
  if (rule) return { kind: "rule", who: rule[1], rounds: Number(rule[2]) };
  return { kind: category || "chaos" };
}

export function ruleCategory(who, rounds) {
  return `${who}_round_based:${rounds}`;
}

export function deckRows(base, edits) {
  const cards = [
    ...base.map((c) => (edits.edits[c.id] ? { ...c, ...edits.edits[c.id] } : c)),
    ...edits.custom,
  ];
  const copiesOf = (id) => edits.copies[id] ?? 1;
  const total = cards.reduce((n, c) => n + copiesOf(c.id), 0);
  return cards.map((card) => {
    const copies = copiesOf(card.id);
    return {
      card,
      copies,
      odds: total ? copies / total : 0,
      status: isCustom(card.id) ? "custom" : edits.edits[card.id] ? "edited" : "base",
    };
  });
}

export function buildDeck(rows) {
  return rows.flatMap((r) => Array(r.copies).fill(r.card));
}

export function setCopies(edits, id, n) {
  const copies = { ...edits.copies };
  const value = Math.max(0, Math.min(MAX_COPIES, Math.round(n)));
  if (value === 1) delete copies[id];
  else copies[id] = value;
  return { ...edits, copies };
}

export function validateCard({ title = "", description = "" }) {
  const errors = {};
  const t = title.trim();
  const d = description.trim();
  if (!t) errors.title = "Give it a title.";
  else if (t.length > LIMITS.title) errors.title = `Keep it to ${LIMITS.title} characters.`;
  if (!d) errors.description = "Say what to do.";
  else if (d.length > LIMITS.description) errors.description = `Keep it to ${LIMITS.description} characters.`;
  return errors;
}

export function saveCard(base, edits, draft, makeId = defaultId) {
  const fields = { title: draft.title.trim(), description: draft.description.trim(), category: draft.category };
  if (draft.id == null) {
    return { ...edits, custom: [...edits.custom, { id: `c-${makeId()}`, ...fields }] };
  }
  if (isCustom(draft.id)) {
    return { ...edits, custom: edits.custom.map((c) => (c.id === draft.id ? { ...c, ...fields } : c)) };
  }
  const original = base.find((c) => c.id === draft.id);
  const unchanged = original
    && original.title === fields.title
    && original.description === fields.description
    && (original.category || null) === fields.category;
  const next = { ...edits.edits };
  if (unchanged) delete next[draft.id];
  else next[draft.id] = fields;
  return { ...edits, edits: next };
}

export function restoreCard(edits, id) {
  const next = { ...edits.edits };
  delete next[id];
  return { ...edits, edits: next };
}

export function deleteCard(edits, id) {
  const copies = { ...edits.copies };
  delete copies[id];
  return { ...edits, copies, custom: edits.custom.filter((c) => c.id !== id) };
}

function matchesFilter(row, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "mine") return row.status === "custom";
  const { kind } = parseCategory(row.card.category);
  return filter === "rules" ? kind === "rule" : kind === filter;
}

export function filterRows(rows, { query = "", filter = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => matchesFilter(r, filter)
    && (!q || `${r.card.title} ${r.card.description}`.toLowerCase().includes(q)));
}

export function shareOf(rows, filter) {
  const total = rows.reduce((n, r) => n + r.copies, 0);
  if (!total) return 0;
  return rows.filter((r) => matchesFilter(r, filter)).reduce((n, r) => n + r.copies, 0) / total;
}

export function formatOdds(p) {
  if (!p) return "—";
  const pct = p * 100;
  if (pct < 0.1) return "<0.1%";
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}
