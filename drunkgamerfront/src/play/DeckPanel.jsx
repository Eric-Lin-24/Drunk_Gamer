import { useState } from "react";
import CardEditor from "./CardEditor.jsx";
import { categoryInfo } from "../lib/categories.js";
import { filterRows, formatOdds, MAX_COPIES, shareOf } from "../lib/deck.js";

const FILTERS = [
  ["all", "ALL"], ["chaos", "CHAOS"], ["dare", "DARE"], ["truth", "TRUTH"],
  ["opinion", "OPINION"], ["power", "POWER"], ["rules", "RULES"], ["mine", "MINE"],
];

export default function DeckPanel({ deck }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // null | "new" | row
  const [confirmReset, setConfirmReset] = useState(false);
  const visible = filterRows(deck.rows, { query, filter });
  const close = () => setEditing(null);

  return (
    <div className="deck">
      <p className="deck__sum">{deck.cards.length} CARDS · {deck.unique} UNIQUE</p>

      <div className="deck__bar">
        <label htmlFor="deck-q" className="sr-only">Search cards</label>
        <input id="deck-q" className="input deck__search" type="search" placeholder="SEARCH CARDS" autoComplete="off"
               value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn deck__new" onClick={() => setEditing("new")}>+ NEW</button>
      </div>

      <div className="deck__filters" role="group" aria-label="Filter cards">
        {FILTERS.map(([key, label]) => (
          <button key={key} className={"chip deck__chip" + (filter === key ? " is-on" : "")}
                  aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
            {key !== "all" && key !== "mine" && <span className="deck__share">{Math.round(shareOf(deck.rows, key) * 100)}%</span>}
          </button>
        ))}
      </div>

      <ul className="deck__list">
        {visible.length === 0 && <li className="roster__empty vt">No cards match.</li>}
        {visible.map((row) => {
          const { card, copies } = row;
          const cat = categoryInfo(card.category);
          return (
            <li key={card.id} className={"drow" + (copies === 0 ? " is-off" : "")}>
              <span className="drow__main">
                <span className="drow__head">
                  <span className="tag" style={{ background: cat.color }}>{cat.label}</span>
                  <span className="drow__t">{card.title}</span>
                  {row.status === "custom" && <span className="tag" style={{ background: "var(--lime)" }}>NEW</span>}
                  {row.status === "edited" && <span className="tag" style={{ background: "var(--violet)" }}>EDITED</span>}
                </span>
                <span className="drow__d">{card.description}</span>
              </span>
              <span className="drow__odds" title="Chance this is the next card dealt">{formatOdds(row.odds)}</span>
              <span className="step">
                <button className="step__b" onClick={() => deck.setCopies(card.id, copies - 1)} disabled={copies === 0}
                        aria-label={`Fewer copies of ${card.title}`}>−</button>
                <span className="step__n" aria-live="polite" aria-label={`${copies} copies`}>×{copies}</span>
                <button className="step__b" onClick={() => deck.setCopies(card.id, copies + 1)} disabled={copies === MAX_COPIES}
                        aria-label={`More copies of ${card.title}`}>+</button>
              </span>
              <button className="drow__edit" onClick={() => setEditing(row)} aria-label={`Edit ${card.title}`}>✎</button>
            </li>
          );
        })}
      </ul>

      <div className="deck__reset">
        {confirmReset ? (
          <>
            <span className="vt deck__confirm">Put every card back to its default count, undo edits and delete your own cards?</span>
            <button className="btn btn--ghost deck__rbtn" onClick={() => setConfirmReset(false)}>KEEP</button>
            <button className="btn deck__rbtn deck__danger" onClick={() => { deck.reset(); setConfirmReset(false); }}>RESET</button>
          </>
        ) : (
          <button className="chip" onClick={() => setConfirmReset(true)}>RESET DECK TO DEFAULT</button>
        )}
      </div>

      {editing && (
        <CardEditor
          row={editing === "new" ? null : editing}
          onCancel={close}
          onSave={(draft) => { deck.save(draft); close(); }}
          onRestore={(id) => { deck.restore(id); close(); }}
          onDelete={(id) => { deck.remove(id); close(); }}
        />
      )}
    </div>
  );
}
