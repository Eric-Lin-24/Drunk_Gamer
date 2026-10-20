import { useGame } from "./useGame.js";
import { useDeck } from "./useDeck.js";
import StartScreen from "./StartScreen.jsx";
import LobbyScreen from "./LobbyScreen.jsx";
import GameScreen from "./GameScreen.jsx";

export default function App() {
  const g = useGame();
  const deck = useDeck();
  const deal = () => g.nextCard(deck.cards);
  if (g.screen === "lobby") {
    return <LobbyScreen players={g.players} deck={deck} error={g.error}
                        onAdd={g.addPlayer} onRemove={g.removePlayer} onStart={deal} />;
  }
  if (g.screen === "game") {
    return <GameScreen room={g.game} players={g.players} error={g.error}
                       onNext={deal} onReset={g.reset} />;
  }
  return <StartScreen error={g.error} onStart={g.start} />;
}
