import GameCard from "./GameCard.jsx";
import { avatarColor } from "../lib/categories.js";
import { groupRules, playerId, rulesForPlayer, turnIndex } from "../lib/turn.js";

export default function GameScreen({ room, players, loading, error, onNext, onReset }) {
  const rules = room?.activeRules || [];
  const group = groupRules(rules);
  const turn = turnIndex(players.length, room?.cardCounter);
  const current = players[turn];
  const round = room?.currentRound || 1;

  return (
    <div className="game">
      <aside className="side" aria-label="Players">
        <div className="side__hd"><span className="kick side__kick">PLAYERS</span><span className="chip side__round">ROUND {round}</span></div>
        <ol className="side__list">
          {players.map((p, i) => {
            const mine = rulesForPlayer(rules, playerId(p));
            return (
              <li key={playerId(p)} className={"prow prow--game" + (i === turn ? " is-on" : "")} aria-current={i === turn ? "true" : undefined}>
                <span className="avatar" style={{ background: avatarColor(i) }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="prow__name">{p.name}</span>
                {mine.length > 0 && (
                  <span className="prow__rules">
                    {mine.map((r) => <span key={r.ruleId} className="rtag">{r.cardTitle} · {r.roundsRemaining}R</span>)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {group.length > 0 && (
          <section className="grules">
            <h2 className="kick grules__kick">GROUP RULES</h2>
            {group.map((r) => (
              <div key={r.ruleId} className="box grule">
                <strong className="grule__t">{r.cardTitle}</strong>
                <p className="vt grule__d">{r.cardDescription}</p>
                <p className="grule__left">{r.roundsRemaining} ROUND{r.roundsRemaining === 1 ? "" : "S"} LEFT</p>
              </div>
            ))}
          </section>
        )}
      </aside>

      <div className="rules-strip" aria-label="Active rules">
        {group.map((r) => <span key={r.ruleId} className="rtag">{r.cardTitle} · ALL · {r.roundsRemaining}R</span>)}
        {players.flatMap((p) => rulesForPlayer(rules, playerId(p)).map((r) => (
          <span key={r.ruleId} className="rtag">{p.name}: {r.cardTitle} · {r.roundsRemaining}R</span>
        )))}
      </div>

      <main className="table">
        <p className="kick table__turn"><span className="table__round">ROUND {round} · </span>{(current?.name || "—").toUpperCase()}'S TURN</p>
        <GameCard key={room?.currentCard?.shownAt || "empty"} card={room?.currentCard} dealt={Number(room?.cardCounter || 0)} />
        <div className="table__acts">
          <button className="btn btn--ghost table__reset" onClick={onReset} disabled={loading}>RESET</button>
          <button className="btn table__next" onClick={onNext} disabled={loading || players.length === 0}>
            {loading ? "DEALING…" : "NEXT CARD ▶"}
          </button>
        </div>
        {error && <p className="err" role="alert">⚠ {error}</p>}
      </main>
    </div>
  );
}
