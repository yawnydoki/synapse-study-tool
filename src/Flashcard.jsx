import React, { useState, useEffect } from 'react';

// Rating button config
const RATINGS = [
  { value: 0, label: 'Again', key: '1', color: '#6e2a2a', textColor: '#c08080' },
  { value: 1, label: 'Good',  key: '2', color: '#2a3a2a', textColor: '#7aaa7a' },
  { value: 2, label: 'Easy',  key: '3', color: '#1a2a3a', textColor: '#7aaaca' },
];

export default function Flashcard({ front, back, onRate, spacedMode = false }) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Spacebar to flip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      }

      // 1/2/3 to rate — only after flipped, only in spaced mode
      if (spacedMode && isFlipped && onRate) {
        if (e.key === '1') onRate(0);
        if (e.key === '2') onRate(1);
        if (e.key === '3') onRate(2);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, spacedMode, onRate]);

  // Reset on new card
  useEffect(() => { setIsFlipped(false); }, [front, back]);

  return (
    <div>
      <div
        className={`flashcard-wrapper${isFlipped ? ' flipped' : ''}`}
        onClick={() => setIsFlipped((v) => !v)}
        role="button"
        aria-label={
          isFlipped
            ? 'Answer side. Click to flip back.'
            : 'Question side. Click to reveal answer.'
        }
      >
        <div className="flashcard-inner">

          <div className="flashcard-front">
            <span className="flashcard-side-label">Question</span>
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              {front}
            </div>
            <span className="flashcard-hint">
              {spacedMode ? 'flip to answer · space' : 'click to reveal · space'}
            </span>
          </div>

          <div className="flashcard-back">
            <span className="flashcard-side-label">Answer</span>
            <div style={{ textAlign: 'center' }}>{back}</div>
            <span className="flashcard-hint">
              {spacedMode ? 'rate below · 1 · 2 · 3' : 'click to flip back · space'}
            </span>
          </div>

        </div>
      </div>

      {/* Rating buttons — only in spaced mode, only after flip */}
      {spacedMode && onRate && (
        <div style={{
          display: 'flex',
          gap: '10px',
          marginTop: '16px',
          opacity: isFlipped ? 1 : 0,
          pointerEvents: isFlipped ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}>
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={(e) => { e.stopPropagation(); onRate(r.value); }}
              style={{
                flex: 1,
                background: r.color,
                border: `1px solid ${r.textColor}44`,
                color: r.textColor,
                padding: '12px 8px',
                fontSize: '0.88rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span style={{ fontWeight: 700 }}>{r.label}</span>
              <span style={{
                fontSize: '0.68rem',
                opacity: 0.6,
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
              }}>
                {r.key}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}