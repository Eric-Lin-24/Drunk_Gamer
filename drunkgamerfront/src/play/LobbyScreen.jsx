import { useState } from "react";
import DeckPanel from "./DeckPanel.jsx";
import { avatarColor } from "../lib/categories.js";
import { playerId } from "../lib/turn.js";

export default function LobbyScreen({ players, deck, error, onAdd, onRemove, onStart }) {
  const [name, setName] = useState("");
  const [tab, setTab] = useState("players");

  function submit(e) {
    e.preventDefault();
    if (onAdd(name)) setName("");
  }

  return (
    <main className="screen screen--center">
      <div className={"box panel lobby" + (tab === "deck" ? " lobby--wide" : "")}>
        <p className="kick">LOBBY</p>
        <h1 className="px-title lobby__title">GAME SETUP</h1>

        <div className="tabs" role="tablist" aria-label="Game setup">
          <button role="tab" id="tab-players" aria-controls="panel-players" aria-selected={tab === "players"}
                  className={"tab" + (tab === "players" ? " is-on" : "")} onClick={() => setTab("players")}>
            PLAYERS · {players.length}
          </button>
          <button role="tab" id="tab-deck" aria-controls="panel-deck" aria-selected={tab === "deck"}
                  className={"tab" + (tab === "deck" ? " is-on" : "")} onClick={() => setTab("deck")}>
            DECK · {deck.cards.length}
          </button>
        </div>

        {tab === "players" ? (
          <div role="tabpanel" id="panel-players" aria-labelledby="tab-players">
            <form className="lobby__field" onSubmit={submit}>
              <label htmlFor="name" className="sr-only">Player name</label>
              <input id="name" className="input" value={name} maxLength={24} autoComplete="off"
                     placeholder="ENTER NAME" onChange={(e) => setName(e.target.value)} />
              <button className="btn lobby__add" disabled={!name.trim()}>ADD</button>
            </form>
            <ol className="roster">
              {players.length === 0 && <li className="roster__empty vt">No players yet. Add at least two for proper turns.</li>}
              {players.map((p, i) => (
                <li className="prow" key={playerId(p)}>
                  <span className="avatar" style={{ background: avatarColor(i) }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="prow__name">{p.name}</span>
                  <span className="prow__ord">P{i + 1}</span>
                  <button className="prow__x" onClick={() => onRemove(playerId(p))} aria-label={`Remove ${p.name}`}>✕</button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div role="tabpanel" id="panel-deck" aria-labelledby="tab-deck">
            <DeckPanel deck={deck} />
          </div>
        )}

        {error && <p className="err lobby__err" role="alert">⚠ {error}</p>}
        <button className="btn lobby__start" onClick={onStart} disabled={players.length < 1 || deck.cards.length === 0}>▶ START GAME</button>
        <p className="hint">
          {deck.cards.length === 0 ? "Your deck is empty. Give some cards at least one copy."
            : tab === "players" ? "Add people in the order you're sitting. That's the turn order."
            : "Odds are the chance a card is the next one dealt."}
        </p>
      </div>
    </main>
  );
}
