import { useEffect, useRef, useState } from "react";
import { KINDS, LIMITS, parseCategory, ruleCategory, validateCard } from "../lib/deck.js";

const TYPES = [...KINDS, "rule"];

export default function CardEditor({ row, onCancel, onSave, onRestore, onDelete }) {
  const card = row?.card;
  const start = parseCategory(card?.category ?? "chaos");
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [kind, setKind] = useState(start.kind);
  const [who, setWho] = useState(start.who ?? "person");
  const [rounds, setRounds] = useState(start.rounds ?? 1);
  const [errors, setErrors] = useState({});
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit(e) {
    e.preventDefault();
    const found = validateCard({ title, description });
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave({ id: card?.id, title, description, category: kind === "rule" ? ruleCategory(who, rounds) : kind });
  }

  const choice = (value, current, set, label) => (
    <button type="button" key={value} className={"chip" + (current === value ? " is-on" : "")}
            aria-pressed={current === value} onClick={() => set(value)}>{label}</button>
  );

  return (
    <div className="modal" onClick={onCancel}>
      <form className="box editor" role="dialog" aria-modal="true" aria-labelledby="editor-h"
            onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2 id="editor-h" className="kick editor__h">{card ? "EDIT CARD" : "NEW CARD"}</h2>

        <label className="editor__lab" htmlFor="ed-title">TITLE</label>
        <input id="ed-title" ref={titleRef} className="input" value={title} maxLength={LIMITS.title}
               autoComplete="off" aria-invalid={Boolean(errors.title)} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && <p className="editor__err">{errors.title}</p>}

        <label className="editor__lab" htmlFor="ed-desc">WHAT TO DO <span className="editor__count">{description.length}/{LIMITS.description}</span></label>
        <textarea id="ed-desc" className="input editor__desc" rows={3} value={description} maxLength={LIMITS.description}
                  aria-invalid={Boolean(errors.description)} onChange={(e) => setDescription(e.target.value)} />
        {errors.description && <p className="editor__err">{errors.description}</p>}

        <span className="editor__lab">TYPE</span>
        <div className="editor__chips">{TYPES.map((t) => choice(t, kind, setKind, t.toUpperCase()))}</div>

        {kind === "rule" && (
          <>
            <span className="editor__lab">WHO</span>
            <div className="editor__chips">
              {choice("person", who, setWho, "ONE PLAYER")}
              {choice("group", who, setWho, "EVERYONE")}
            </div>
            <span className="editor__lab">HOW MANY ROUNDS</span>
            <div className="editor__chips">{[1, 2, 3, 4].map((n) => choice(n, rounds, setRounds, String(n)))}</div>
          </>
        )}

        <div className="editor__acts">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>CANCEL</button>
          {row?.status === "edited" && <button type="button" className="btn btn--ghost" onClick={() => onRestore(card.id)}>RESTORE</button>}
          {row?.status === "custom" && <button type="button" className="btn btn--ghost editor__del" onClick={() => onDelete(card.id)}>DELETE</button>}
          <button className="btn editor__save">SAVE</button>
        </div>
      </form>
    </div>
  );
}
