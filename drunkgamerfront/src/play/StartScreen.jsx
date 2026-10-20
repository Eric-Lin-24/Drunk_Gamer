export default function StartScreen({ error, onStart }) {
  return (
    <main className="screen screen--center">
      <div className="box panel start">
        <a className="chip start__back" href="/">◀ HOME</a>
        <p className="kick">INSERT FRIENDS TO CONTINUE</p>
        <h1 className="px-title start__title">DRUNK GAMER</h1>
        <p className="vt">Pass one phone around. It tells you whose turn it is and what to do.</p>
        {error && <p className="err" role="alert">⚠ {error}</p>}
        <button className="btn start__btn" onClick={onStart}>▶ NEW GAME</button>
      </div>
    </main>
  );
}
