import { useState } from "react";
import { avatarColor } from "../lib/categories.js";
import { playerId } from "../lib/turn.js";

export default function LobbyScreen({ players, loading, error, onAdd, onRemove, onStart }) {
  const [name, setName] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (await onAdd(name)) setName("");
  }

  return (
    <main className="screen screen--center">
      <div className="box panel lobby">
        <p className="kick">PLAYER SELECT</p>
        <h1 className="px-title lobby__title">WHO'S PLAYING?</h1>
        <form className="lobby__field" onSubmit={submit}>
          <label htmlFor="name" className="sr-only">Player name</label>
          <input id="name" className="input" value={name} maxLength={24} autoComplete="off"
                 placeholder="ENTER NAME" onChange={(e) => setName(e.target.value)} disabled={loading} />
          <button className="btn lobby__add" disabled={loading || !name.trim()}>ADD</button>
        </form>
        {error && <p className="err" role="alert">⚠ {error}</p>}
        <ol className="roster">
          {players.length === 0 && <li className="roster__empty vt">No players yet. Add at least two for proper turns.</li>}
          {players.map((p, i) => (
            <li className="prow" key={playerId(p)}>
              <span className="avatar" style={{ background: avatarColor(i) }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="prow__name">{p.name}</span>
              <span className="prow__ord">P{i + 1}</span>
              <button className="prow__x" onClick={() => onRemove(playerId(p))} disabled={loading} aria-label={`Remove ${p.name}`}>✕</button>
            </li>
          ))}
        </ol>
        <button className="btn lobby__start" onClick={onStart} disabled={loading || players.length < 1}>▶ START GAME</button>
        <p className="hint">Add people in the order you're sitting. That's the turn order.</p>
      </div>
    </main>
  );
}
