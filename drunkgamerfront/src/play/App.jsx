import { useRoom } from "./useRoom.js";
import StartScreen from "./StartScreen.jsx";
import LobbyScreen from "./LobbyScreen.jsx";
import GameScreen from "./GameScreen.jsx";

export default function App() {
  const r = useRoom();
  if (r.screen === "lobby") {
    return <LobbyScreen players={r.players} loading={r.loading} error={r.error}
                        onAdd={r.addPlayer} onRemove={r.removePlayer} onStart={r.startGame} />;
  }
  if (r.screen === "game") {
    return <GameScreen room={r.room} players={r.players} loading={r.loading} error={r.error}
                       onNext={r.nextCard} onReset={r.reset} />;
  }
  return <StartScreen loading={r.loading} error={r.error} onStart={r.createRoom} />;
}
