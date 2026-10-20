import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { playerId, playersInGame } from "../lib/turn.js";

const KEY = "roomId";

function readSavedRoom() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}
function saveRoom(id) {
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function useRoom() {
  const [roomId, setRoomId] = useState(readSavedRoom);
  const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState("start"); // start | lobby | game
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const forget = useCallback(() => {
    saveRoom("");
    setRoomId("");
    setRoom(null);
    setScreen("start");
  }, []);

  // Restore a saved room once on load (no polling).
  useEffect(() => {
    if (!roomId || room) return;
    run(async () => {
      try {
        const data = await api(`/state/${encodeURIComponent(roomId)}`);
        setRoom(data);
        setScreen(data?.currentCard ? "game" : "lobby");
      } catch (e) {
        if (e.status === 404) forget();
        else throw e;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = () =>
    run(async () => {
      const data = await api("/create-room", { method: "POST", body: { hostName: "Host" } });
      saveRoom(data.roomId);
      setRoomId(data.roomId);
      setRoom({ roomId: data.roomId, players: [], cardCounter: 0, currentRound: 1, activeRules: [] });
      setScreen("lobby");
    });

  const addPlayer = async (name) => {
    const clean = name.trim();
    if (!clean) return false;
    const ok = await run(async () => {
      const res = await api("/add-player", { method: "POST", body: { roomId, name: clean } });
      setRoom((prev) => ({ ...prev, players: [...(prev?.players || []), res.player] }));
      return true;
    });
    return Boolean(ok);
  };

  const removePlayer = (id) =>
    run(async () => {
      await api("/remove-player", { method: "POST", body: { roomId, playerId: id } });
      setRoom((prev) => ({ ...prev, players: (prev?.players || []).filter((p) => playerId(p) !== id) }));
    });

  const nextCard = () =>
    run(async () => {
      const res = await api("/next-card", { method: "POST", body: { roomId } });
      setRoom((prev) => ({
        ...prev,
        currentCard: res.currentCard || res.card,
        cardCounter: Number(prev?.cardCounter || 0) + 1,
        currentRound: res.currentRound || prev?.currentRound || 1,
        activeRules: res.activeRules || prev?.activeRules || [],
      }));
      setScreen("game");
    });

  const reset = async () => {
    await run(async () => {
      if (roomId) await api("/reset", { method: "POST", body: { roomId } });
    });
    forget();
  };

  return {
    screen, room, loading, error,
    players: playersInGame(room),
    createRoom, addPlayer, removePlayer,
    startGame: nextCard, nextCard, reset,
  };
}
