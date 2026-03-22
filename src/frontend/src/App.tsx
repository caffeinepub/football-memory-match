import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard";
type GameMode = "default" | "custom";

interface CardData {
  id: string;
  symbol: string;
}

interface WinResult {
  time: number;
  moves: number;
  isNew: boolean;
  prevBest: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────
const GRID: Record<Difficulty, { cols: number; rows: number }> = {
  easy: { cols: 4, rows: 3 },
  medium: { cols: 5, rows: 4 },
  hard: { cols: 6, rows: 6 },
};

const SYMBOLS: Record<Difficulty, string[]> = {
  easy: ["⚽", "🟥", "🔶", "🥅", "👟", "👕"],
  medium: ["⚽", "🥅", "👟", "👕", "🧤", "🏆", "🟥", "🟨", "🎽", "📣"],
  hard: [
    "⚽",
    "🥅",
    "👟",
    "👕",
    "🧤",
    "🏆",
    "🟥",
    "🟨",
    "🎽",
    "📣",
    "🧢",
    "🎯",
    "🏟️",
    "🚩",
    "🧃",
    "🧊",
    "💪",
    "🔥",
  ],
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy 4×3",
  medium: "Medium 5×4",
  hard: "Hard 6×6",
};

// ── Pure helpers ─────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck(diff: Difficulty, symbols: string[]): CardData[] {
  const pairCount = (GRID[diff].cols * GRID[diff].rows) / 2;
  const pool = symbols.slice(0, pairCount);
  return shuffle(
    [...pool, ...pool].map((symbol, idx) => ({
      id: `${symbol}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      symbol,
    })),
  );
}

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function bestKey(mode: GameMode, diff: Difficulty) {
  return `mmBest:${mode}:${diff}`;
}

function getBest(mode: GameMode, diff: Difficulty): number | null {
  const v = localStorage.getItem(bestKey(mode, diff));
  return v ? Number(v) : null;
}

function saveBest(mode: GameMode, diff: Difficulty, secs: number): boolean {
  const prev = getBest(mode, diff);
  if (prev === null || secs < prev) {
    localStorage.setItem(bestKey(mode, diff), String(secs));
    return true;
  }
  return false;
}

// ── Card sub-component ───────────────────────────────────────────────────────
interface CardProps {
  card: CardData;
  flipped: boolean;
  matched: boolean;
  matchPop: boolean;
  locked: boolean;
  onClick: (id: string) => void;
}

function MemoryCard({
  card,
  flipped,
  matched,
  matchPop,
  locked,
  onClick,
}: CardProps) {
  const active = flipped || matched;
  const innerClass = [
    "card-inner",
    active ? "flipped" : "",
    matched ? "card-matched" : "",
    matchPop ? "card-match-pop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className="card-shell"
      style={{
        background: "none",
        border: 0,
        padding: 0,
        cursor: locked || matched ? "default" : "pointer",
        borderRadius: "12px",
        aspectRatio: "3 / 4",
        display: "block",
        width: "100%",
      }}
      disabled={locked || matched}
      aria-label={
        matched
          ? `Matched ${card.symbol}`
          : active
            ? `Flipped ${card.symbol}`
            : "Hidden card"
      }
      onClick={() => !locked && !matched && !flipped && onClick(card.id)}
      data-ocid="game.card"
    >
      <div className={innerClass}>
        <div className="card-face card-front">
          <span
            style={{ fontSize: "clamp(1.2rem, 4vw, 1.8rem)", opacity: 0.85 }}
          >
            ⚽
          </span>
        </div>
        <div className="card-face card-back">
          <span className="emoji-display" aria-hidden="true">
            {card.symbol}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const INIT_DIFF: Difficulty = "easy";
  const INIT_MODE: GameMode = "default";

  const [difficulty, setDifficulty] = useState<Difficulty>(INIT_DIFF);
  const [gameMode, setGameMode] = useState<GameMode>(INIT_MODE);
  // Initialize deck and revealIds from the same initial deck so the brief reveal works on mount
  const _initDeckRef = useRef<CardData[]>([]);
  const [deck, setDeck] = useState<CardData[]>(() => {
    const d = makeDeck(INIT_DIFF, SYMBOLS[INIT_DIFF]);
    _initDeckRef.current = d;
    return d;
  });
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [popIds, setPopIds] = useState<Set<string>>(new Set());
  const [revealIds, setRevealIds] = useState<Set<string>>(
    () => new Set(_initDeckRef.current.map((c) => c.id)),
  );
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [status, setStatus] = useState("Press Start Game to begin.");
  const [customInput, setCustomInput] = useState(
    "⚽ 🥅 👟 👕 🧤 🏆 🟥 🟨 🎽 📣 🧢 🎯 🏟️ 🚩 🧃 🧊 💪 🔥",
  );
  const [bestDisplay, setBestDisplay] = useState(() => {
    const b = getBest(INIT_MODE, INIT_DIFF);
    return b !== null ? formatTime(b) : "--";
  });
  const [winState, setWinState] = useState<WinResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Brief reveal on mount ────────────────────────────────────────────────
  const mountRevealDone = useRef(false);
  useEffect(() => {
    if (mountRevealDone.current) return;
    mountRevealDone.current = true;
    setLocked(true);
    setStatus("Memorize the board...");
    const t = setTimeout(() => {
      setRevealIds(new Set());
      setLocked(false);
      setStatus("Press any card to start the timer.");
    }, 1100);
    return () => clearTimeout(t);
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerOn]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pairCount = (GRID[difficulty].cols * GRID[difficulty].rows) / 2;

  const refreshBest = useCallback((mode: GameMode, diff: Difficulty) => {
    const b = getBest(mode, diff);
    setBestDisplay(b !== null ? formatTime(b) : "--");
  }, []);

  const parseCustom = useCallback((): string[] | null => {
    const unique = [
      ...new Set(
        customInput
          .trim()
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
    if (unique.length < pairCount) {
      setStatus(`Need ${pairCount} unique emojis. You have ${unique.length}.`);
      return null;
    }
    return unique.slice(0, pairCount);
  }, [customInput, pairCount]);

  // ── New game ─────────────────────────────────────────────────────────────
  const newGame = useCallback(
    (reveal = true) => {
      const symbols =
        gameMode === "custom" ? parseCustom() : SYMBOLS[difficulty];
      if (!symbols) return;

      if (timerRef.current) clearInterval(timerRef.current);
      setTimerOn(false);
      setElapsed(0);
      setMoves(0);
      setFlippedIds([]);
      setMatchedIds(new Set());
      setPopIds(new Set());
      setRevealIds(new Set());
      setLocked(false);
      setWinState(null);
      setGameStarted(false);

      const newDeck = makeDeck(difficulty, symbols);
      setDeck(newDeck);
      refreshBest(gameMode, difficulty);

      if (reveal) {
        setRevealIds(new Set(newDeck.map((c) => c.id)));
        setLocked(true);
        setStatus("Memorize the board...");
        const t = setTimeout(() => {
          setRevealIds(new Set());
          setLocked(false);
          setStatus("Press any card to start the timer.");
        }, 1100);
        return () => clearTimeout(t);
      }
      setStatus("Press any card to start the timer.");
    },
    [difficulty, gameMode, parseCustom, refreshBest],
  );

  // ── Card click ───────────────────────────────────────────────────────────
  const onCardClick = useCallback(
    (id: string) => {
      if (locked) return;
      if (flippedIds.includes(id) || matchedIds.has(id)) return;

      if (!gameStarted) {
        setGameStarted(true);
        setTimerOn(true);
        setStatus("Game started! Find all pairs.");
      }

      const next = [...flippedIds, id];
      setFlippedIds(next);

      if (next.length < 2) return;

      setLocked(true);
      setMoves((m) => m + 1);

      const [idA, idB] = next;
      const cardA = deck.find((c) => c.id === idA)!;
      const cardB = deck.find((c) => c.id === idB)!;

      if (cardA.symbol === cardB.symbol) {
        const newMatched = new Set([...matchedIds, idA, idB]);
        setPopIds(new Set([idA, idB]));
        setTimeout(() => {
          setMatchedIds(newMatched);
          setPopIds(new Set());
          setFlippedIds([]);
          setLocked(false);

          if (newMatched.size === deck.length) {
            setTimerOn(false);
            setElapsed((e) => {
              const prevBest = getBest(gameMode, difficulty);
              const isNew = saveBest(gameMode, difficulty, e);
              setWinState({ time: e, moves: moves + 1, isNew, prevBest });
              refreshBest(gameMode, difficulty);
              return e;
            });
            setStatus("You won! 🎉 Press Play Again.");
          } else {
            setStatus("Great match! ✅");
          }
        }, 320);
      } else {
        setStatus("No match. Try again!");
        setTimeout(() => {
          setFlippedIds([]);
          setLocked(false);
          setStatus("Keep going!");
        }, 900);
      }
    },
    [
      locked,
      flippedIds,
      matchedIds,
      deck,
      gameStarted,
      gameMode,
      difficulty,
      moves,
      refreshBest,
    ],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  const { cols } = GRID[difficulty];
  const accentGreen = "#06d6a0";
  const dangerRed = "#ef476f";
  const warnYellow = "#ffd166";

  const selectStyle: React.CSSProperties = {
    flex: 1,
    background: "rgba(255,255,255,0.1)",
    color: "#f0f4ff",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
  };

  const btnBase: React.CSSProperties = {
    flex: 1,
    border: 0,
    borderRadius: "9px",
    padding: "9px 14px",
    fontSize: "0.9rem",
    fontWeight: 800,
    cursor: "pointer",
    transition: "filter .15s, transform .12s",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 12% 10%, #3a2d95 0%, transparent 38%), radial-gradient(circle at 88% 8%, #1a6fab 0%, transparent 42%), linear-gradient(170deg, #0f0f2e, #0e2456)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'Bricolage Grotesque', Arial, sans-serif",
        color: "#f0f4ff",
      }}
    >
      <main
        style={{
          width: "min(960px, 100%)",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(12,17,55,0.78)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.4)",
          padding: "20px",
        }}
      >
        {/* ── Header ── */}
        <header style={{ textAlign: "center", marginBottom: "16px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(1.4rem,4vw,2rem)",
              fontWeight: 800,
              letterSpacing: "0.03em",
              textShadow: "0 3px 12px rgba(0,0,0,0.4)",
            }}
          >
            ⚽ Memory Match
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem", opacity: 0.75 }}>
            Flip cards, match football-themed pairs, and beat your best time.
          </p>
        </header>

        {/* ── Toolbar ── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          {/* Stats */}
          <div
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>⏱️ Time:</span>
            <strong
              style={{ color: warnYellow, minWidth: "46px" }}
              aria-live="polite"
            >
              {formatTime(elapsed)}
            </strong>
            <span style={{ fontSize: "0.85rem" }}>🕹️ Moves:</span>
            <strong style={{ color: warnYellow }} aria-live="polite">
              {moves}
            </strong>
          </div>

          {/* Difficulty */}
          <div
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <label
              htmlFor="diffSelect"
              style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              Difficulty:
            </label>
            <select
              id="diffSelect"
              data-ocid="game.select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              style={selectStyle}
            >
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d} style={{ background: "#0f1535" }}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <label
              htmlFor="modeSelect"
              style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              Mode:
            </label>
            <select
              id="modeSelect"
              data-ocid="game.select"
              value={gameMode}
              onChange={(e) => {
                const m = e.target.value as GameMode;
                setGameMode(m);
                refreshBest(m, difficulty);
                setStatus(
                  m === "custom"
                    ? "Enter emojis, then press Start Game."
                    : "Default mode selected. Press Start Game.",
                );
              }}
              style={selectStyle}
            >
              <option value="default" style={{ background: "#0f1535" }}>
                Default emojis
              </option>
              <option value="custom" style={{ background: "#0f1535" }}>
                Custom emojis
              </option>
            </select>
          </div>

          {/* Actions */}
          <div
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              data-ocid="game.primary_button"
              onClick={() => newGame(true)}
              style={{ ...btnBase, background: accentGreen, color: "#052b1f" }}
            >
              Start Game
            </button>
            <button
              type="button"
              data-ocid="game.secondary_button"
              onClick={() => newGame(false)}
              style={{ ...btnBase, background: dangerRed, color: "#fff" }}
            >
              Reset
            </button>
          </div>

          {/* Best */}
          <div
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>🏆 Best:</span>
            <strong
              style={{ color: warnYellow }}
              aria-live="polite"
              data-ocid="game.panel"
            >
              {bestDisplay}
            </strong>
          </div>
        </section>

        {/* ── Custom emoji panel ── */}
        {gameMode === "custom" && (
          <section
            className="glass"
            style={{
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "12px",
            }}
            aria-live="polite"
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "0.88rem",
                color: "#ffe8a4",
                lineHeight: 1.4,
              }}
            >
              Custom mode needs <strong>{pairCount}</strong> unique emojis for{" "}
              {DIFFICULTY_LABELS[difficulty]}. Enter emojis separated by spaces.
            </p>
            <textarea
              data-ocid="game.textarea"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Example: 😀 😎 🐱 🍕 🚗 🌟"
              style={{
                width: "100%",
                minHeight: "64px",
                resize: "vertical",
                background: "#fff",
                color: "#1c2147",
                border: "1px solid #c0caee",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "1rem",
                fontFamily: "inherit",
                fontWeight: 600,
                boxSizing: "border-box",
              }}
            />
          </section>
        )}

        {/* ── Tutorial ── */}
        <details
          className="glass"
          style={{
            borderRadius: "12px",
            marginBottom: "10px",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              padding: "10px 14px",
              fontWeight: 700,
              color: "#ffdf7e",
              fontSize: "0.9rem",
            }}
          >
            📘 Quick Tutorial
          </summary>
          <p
            style={{
              margin: 0,
              padding: "0 14px 12px",
              fontSize: "0.87rem",
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            Tap two cards to flip and reveal emojis. Matching pairs stay face
            up. If they do not match, they flip back after ~1 second. Match all
            pairs to win! <strong>Custom emojis:</strong> enter unique emojis
            separated by spaces.
          </p>
        </details>

        {/* ── Status ── */}
        <p
          aria-live="polite"
          style={{
            margin: "0 0 10px",
            textAlign: "center",
            fontSize: "0.88rem",
            color: "#c9e4ff",
            minHeight: "1.2em",
          }}
        >
          {status}
        </p>

        {/* ── Board ── */}
        <section
          className="board-grid"
          aria-label="Memory Match game board"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          data-ocid="game.table"
        >
          {deck.map((card, i) => (
            <MemoryCard
              key={card.id}
              card={card}
              flipped={flippedIds.includes(card.id) || revealIds.has(card.id)}
              matched={matchedIds.has(card.id)}
              matchPop={popIds.has(card.id)}
              locked={locked}
              onClick={onCardClick}
              data-ocid={`game.item.${i + 1}`}
            />
          ))}
        </section>

        {/* ── Footer ── */}
        <footer
          style={{
            textAlign: "center",
            marginTop: "18px",
            fontSize: "0.78rem",
            opacity: 0.45,
          }}
        >
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            caffeine.ai
          </a>
        </footer>
      </main>

      {/* ── Win overlay ── */}
      {winState && (
        <dialog
          open
          className="overlay-bg"
          aria-labelledby="winTitle"
          data-ocid="game.dialog"
          style={{
            border: 0,
            background: "transparent",
            maxWidth: "100vw",
            maxHeight: "100vh",
          }}
        >
          <div
            className="glass"
            style={{
              width: "min(420px, 90vw)",
              borderRadius: "16px",
              textAlign: "center",
              padding: "24px 20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <h2
              id="winTitle"
              style={{
                margin: "0 0 10px",
                color: warnYellow,
                fontSize: "1.6rem",
              }}
            >
              You Win! 🎉
            </h2>
            <p style={{ margin: "0 0 6px", fontSize: "1rem" }}>
              Finished in <strong>{formatTime(winState.time)}</strong> with{" "}
              <strong>{winState.moves}</strong> moves.
            </p>
            {winState.isNew ? (
              <p
                style={{
                  color: accentGreen,
                  fontWeight: 700,
                  margin: "0 0 16px",
                }}
              >
                🌟 New best score!
              </p>
            ) : (
              <p
                style={{ margin: "0 0 16px", fontSize: "0.9rem", opacity: 0.8 }}
              >
                Best:{" "}
                {winState.prevBest !== null
                  ? formatTime(winState.prevBest)
                  : "--"}
              </p>
            )}
            <button
              type="button"
              data-ocid="game.confirm_button"
              onClick={() => newGame(true)}
              style={{
                background: dangerRed,
                color: "#fff",
                border: 0,
                borderRadius: "10px",
                padding: "12px 28px",
                fontSize: "1rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Play Again
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
