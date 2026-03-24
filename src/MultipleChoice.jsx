import React, { useState, useEffect } from 'react';

export default function MultipleChoice({ question, options, correctAnswer, onNext }) {
  const [selected, setSelected]           = useState(null);
  const [shuffledOptions, setShuffledOptions] = useState([]);

  useEffect(() => {
    // Don't shuffle True/False — keep True before False
    const isTrueFalse =
      options.length === 2 &&
      options.map((o) => o.trim().toLowerCase()).sort().join() === 'false,true';
    setShuffledOptions(
      isTrueFalse
        ? ['True', 'False']
        : [...options].sort(() => Math.random() - 0.5)
    );
    setSelected(null);
  }, [question, options]);

  const handleSelect = (option) => {
    if (selected) return;
    setSelected(option);
    setTimeout(() => { onNext(option === correctAnswer); }, 1400);
  };

  // Keyboard shortcuts 1–4
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selected) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < shuffledOptions.length) {
        handleSelect(shuffledOptions[idx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shuffledOptions, selected]);

  return (
    <div className="card slide-in">
      <p className="mcq-question">{question}</p>

      <div className="mcq-options">
        {shuffledOptions.map((option, index) => {
          let cls = 'mcq-option';
          if (selected) {
            if (option === correctAnswer) cls += ' correct';
            else if (option === selected) cls += ' incorrect';
          }

          return (
            <button
              key={index}
              className={cls}
              disabled={!!selected}
              onClick={() => handleSelect(option)}
            >
              <span className="mcq-key">{index + 1}.</span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}