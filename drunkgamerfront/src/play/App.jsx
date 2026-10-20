import { useGame } from "./useGame.js";
import StartScreen from "./StartScreen.jsx";
import LobbyScreen from "./LobbyScreen.jsx";
import GameScreen from "./GameScreen.jsx";

export default function App() {
  const g = useGame();
  if (g.screen === "lobby") {
    return <LobbyScreen players={g.players} error={g.error}
                        onAdd={g.addPlayer} onRemove={g.removePlayer} onStart={g.nextCard} />;
  }
  if (g.screen === "game") {
    return <GameScreen room={g.game} players={g.players} error={g.error}
                       onNext={g.nextCard} onReset={g.reset} />;
  }
  return <StartScreen error={g.error} onStart={g.start} />;
}
