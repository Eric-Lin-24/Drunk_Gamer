import React, { useMemo, useState } from "react";

const API_BASE = "https://oq99xk9tcl.execute-api.us-east-1.amazonaws.com/"; // no trailing slash

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function computeTurnIndex(room) {
  const n = room?.players?.length || 0;
  if (!n) return 0;
  const cc = Number(room?.cardCounter || 0);
  if (cc <= 0) return 0;
  return (cc - 1) % n;
}

function StartScreen({ loading, onStart, error }) {
  return (
    <div className="screen center">
      <div className="panel hero">
        <h1>Party Cards</h1>
        <p className="sub">
          Add players, then deal chaos. Turns rotate automatically.
        </p>
        {error ? <div className="error">⚠ {error}</div> : null}
        <button className="btn big" disabled={loading} onClick={onStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}

function LobbyScreen({
  loading,
  error,
  players,
  playerName,
  setPlayerName,
  onAddPlayer,
  onRemovePlayer,
  onStartGame
}) {
  return (
    <div className="screen">
      <div className="panel">
        <h2>Add Players</h2>

        <div className="row">
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter name"
            onKeyDown={(e) => e.key === "Enter" && onAddPlayer()}
            disabled={loading}
          />
          <button className="btn" onClick={onAddPlayer} disabled={loading}>
            Add
          </button>
        </div>

        {error ? <div className="error">⚠ {error}</div> : null}

        <div className="playersGrid">
          {players?.length ? (
            players.map((p) => {
              const playerId = p.id || p.playerId; // Support both id and playerId
              return (
                <div className="playerPill" key={playerId}>
                  <span className="playerName">{p.name}</span>
                  <button
                    className="pillX"
                    onClick={() => onRemovePlayer(playerId)}
                    disabled={loading}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          ) : (
            <div className="muted">No players yet. Add at least 2 for better turns.</div>
          )}
        </div>

        <div className="row">
          <button
            className="btn big"
            onClick={onStartGame}
            disabled={loading || (players?.length || 0) < 1}
          >
            Start Game
          </button>
        </div>

        <div className="hint">
          Tip: Add people in the order you want turns to go.
        </div>
      </div>
    </div>
  );
}

function GameScreen({ room, loading, error, onNextCard, onReset }) {
  // Filter out the host from players display
  const allPlayers = room?.players || [];
  const players = allPlayers.filter(p => p.name !== "Host");
  
  // Compute turn index based on filtered players
  const n = players.length;
  const cc = Number(room?.cardCounter || 0);
  const turnIndex = (n && cc > 0) ? (cc - 1) % n : 0;
  
  const currentPlayer = players[turnIndex];
  const card = room?.currentCard;
  const currentRound = room?.currentRound || 1;
  const activeRules = room?.activeRules || [];
  
  // Separate person and group rules
  const groupRules = activeRules.filter(r => r.type === "group");
  const getPlayerRules = (playerId) => activeRules.filter(r => r.type === "person" && r.playerId === playerId);

  console.log('GameScreen - Room:', room);
  console.log('GameScreen - Card:', card);
  console.log('GameScreen - Has card:', !!card);
  console.log('GameScreen - Current Round:', currentRound);
  console.log('GameScreen - Active Rules:', activeRules);
  console.log('GameScreen - Group Rules:', groupRules);

  // Check if card has actual data
  const hasCard = card && (card.title || card.description);

  return (
    <div className="screen gameScreen">
      <div className="playersList">
        <div className="playersHeader">Players (Round {currentRound})</div>
        {players.map((p, idx) => {
          const playerId = p.id || p.playerId; // Support both id and playerId
          const playerRules = getPlayerRules(playerId);
          return (
            <div
              key={playerId}
              className={"playerItem" + (idx === turnIndex ? " active" : "")}
            >
              <div className="playerInitial">{p.name.slice(0, 1).toUpperCase()}</div>
              <div className="playerFullName">
                {p.name}
                {playerRules.length > 0 && (
                  <div className="playerRules">
                    {playerRules.map((rule) => (
                      <div key={rule.ruleId} className="ruleTag">
                        {rule.cardTitle} ({rule.roundsRemaining}r)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {groupRules.length > 0 && (
          <div className="groupRulesSection">
            <div className="groupRulesHeader">Group Rules</div>
            {groupRules.map((rule) => (
              <div key={rule.ruleId} className="groupRule">
                <strong>{rule.cardTitle}</strong>
                <div className="ruleDesc">{rule.cardDescription}</div>
                <div className="ruleRounds">{rule.roundsRemaining} rounds left</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gameMain">
        <div className="turnInfo">
          <div className="turnLabel">{currentPlayer?.name || "—"}'s turn</div>
        </div>

        <div className={"card" + (!hasCard ? " empty" : "")}>
          {!hasCard ? (
            <>
              <div className="cardTitle">Ready?</div>
              <div className="cardDesc">Hit "Next Card" to deal the first one.</div>
            </>
          ) : (
            <>
              <div className="cardTitle">{card.title}</div>
              <div className="cardDesc">{card.description}</div>
            </>
          )}
        </div>

        <div className="gameActions">
          <button className="nextBtn" onClick={onNextCard} disabled={loading || players.length === 0}>
            {loading ? 'Loading...' : 'Next card'}
          </button>
          <button className="resetBtn" onClick={onReset} disabled={loading}>
            Reset Game
          </button>
        </div>

        {error ? <div className="error">⚠ {error}</div> : null}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("start"); // start | lobby | game
  const [roomId, setRoomId] = useState(() => localStorage.getItem("roomId") || "");
  const roomIdClean = useMemo(() => (roomId || "").trim().toUpperCase(), [roomId]);

  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!roomIdClean) return;
    setLoading(true);
    setError("");
    try {
      const data = await api(`/state/${encodeURIComponent(roomIdClean)}`);
      setRoom(data);
      if (data?.currentCard) setScreen("game");
      else setScreen("lobby");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startFlowCreateRoom() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/create-room", { method: "POST", body: { hostName: "Host" } });
      localStorage.setItem("roomId", data.roomId);
      setRoomId(data.roomId);
      setRoom(data);
      setScreen("lobby");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addPlayer() {
    const name = playerName.trim();
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      const res = await api("/add-player", { method: "POST", body: { roomId: roomIdClean, name } });
      // minimize calls: update local state instead of re-fetch
      setRoom((prev) => {
        const prevPlayers = prev?.players || [];
        return prev ? { ...prev, players: [...prevPlayers, res.player] } : prev;
      });
      setPlayerName("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removePlayer(playerId) {
    setLoading(true);
    setError("");
    try {
      await api("/remove-player", { method: "POST", body: { roomId: roomIdClean, playerId } });
      // minimize calls: update local state
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: (prev.players || []).filter((p) => (p.id || p.playerId) !== playerId) };
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    // Deal first card
    await nextCard(true);
  }

  async function nextCard(isStart = false) {
    setLoading(true);
    setError("");
    try {
      const res = await api("/next-card", { method: "POST", body: { roomId: roomIdClean } });
      console.log('API response:', res);
      console.log('Card received:', res.currentCard || res.card);
      console.log('Current Round from API:', res.currentRound);
      console.log('Active Rules from API:', res.activeRules);
      
      // The API returns either res.card or res.currentCard depending on the backend version
      const cardData = res.currentCard || res.card;
      
      // Update room state with the new card, round, and active rules
      const nextCounter = Number(room?.cardCounter || 0) + 1;
      const updatedRoom = {
        ...room,
        currentCard: cardData,
        cardCounter: nextCounter,
        currentRound: res.currentRound || room?.currentRound || 1,
        activeRules: res.activeRules || room?.activeRules || []
      };
      
      console.log('Updated Room:', updatedRoom);
      setRoom(updatedRoom);
      
      // Switch to game screen only after room is updated
      if (isStart) {
        setScreen("game");
      }
    } catch (e) {
      setError(e.message);
      console.error('Error fetching card:', e);
    } finally {
      setLoading(false);
    }
  }

  async function resetAll() {
    setLoading(true);
    setError("");
    try {
      if (roomIdClean) {
        await api("/reset", { method: "POST", body: { roomId: roomIdClean } });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      // local reset
      localStorage.removeItem("roomId");
      setRoomId("");
      setRoom(null);
      setPlayerName("");
      setScreen("start");
      setLoading(false);
    }
  }

  // If you reload and have a roomId saved, do ONE fetch to restore state (no polling).
  React.useEffect(() => {
    if (!roomIdClean || room) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdClean]);

  return (
    <div className="app">
      {screen === "start" ? (
        <StartScreen loading={loading} onStart={startFlowCreateRoom} error={error} />
      ) : screen === "lobby" ? (
        <LobbyScreen
          loading={loading}
          error={error}
          players={room?.players || []}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
          onStartGame={startGame}
        />
      ) : (
        <GameScreen room={room} loading={loading} error={error} onNextCard={() => nextCard(false)} onReset={resetAll} />
      )}
    </div>
  );
}
