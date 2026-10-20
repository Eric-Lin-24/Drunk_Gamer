import { categoryInfo } from "../lib/categories.js";

export default function GameCard({ card, dealt }) {
  if (!card?.title && !card?.description) {
    return (
      <article className="gcard gcard--empty">
        <h2 className="px-title gcard__title">READY?</h2>
        <p className="vt gcard__desc">Hit NEXT CARD to deal the first one.</p>
      </article>
    );
  }
  const cat = categoryInfo(card.category);
  return (
    <article className="gcard" style={{ "--c": cat.color }} aria-live="polite">
      <div className="gcard__top">
        <span className="tag" style={{ background: cat.color }}>{cat.label}</span>
        {card.id != null && <span className="gcard__no">#{String(card.id).padStart(3, "0")}</span>}
      </div>
      <h2 className="px-title gcard__title">{card.title}</h2>
      <p className="vt gcard__desc">{card.description}</p>
      <div className="gcard__bot"><span>CARD {dealt} THIS GAME</span><span aria-hidden="true">☠</span></div>
    </article>
  );
}
