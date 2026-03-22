import React, { useState, useEffect } from 'react';

export default function MultipleChoice({ question, options, correctAnswer, onNext }) {
  // ... keep all your existing state and useEffect logic exactly the same ...
  const [selected, setSelected] = useState(null);
  const [shuffledOptions, setShuffledOptions] = useState([]);

  useEffect(() => {
    setShuffledOptions([...options].sort(() => Math.random() - 0.5));
    setSelected(null);
  }, [question, options]);

  const handleSelect = (option) => {
    if (selected) return; 
    setSelected(option);
    setTimeout(() => { onNext(option === correctAnswer); }, 1500); 
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selected) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key) - 1;
        if (shuffledOptions[index]) {
          handleSelect(shuffledOptions[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shuffledOptions, selected]);

  return (
    // ADDED key={question} AND className="card slide-in" HERE
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ marginBottom: '25px' }}>{question}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {shuffledOptions.map((option, index) => {
          let bgColor = 'var(--surface)';
          let color = 'var(--text)';
          let border = '1px solid var(--border)';
          
          if (selected) {
            if (option === correctAnswer) {
              bgColor = 'var(--correct)'; color = '#fff'; border = '1px solid #5c754d';
            } else if (option === selected) {
              bgColor = 'var(--incorrect)'; color = '#fff'; border = '1px solid #8c3636';
            }
          }

          return (
            <button
              key={index}
              disabled={!!selected}
              onClick={() => handleSelect(option)}
              style={{
                backgroundColor: bgColor, color: color, border: border,
                padding: '16px', fontSize: '1rem', textAlign: 'left',
                fontWeight: 'normal', display: 'flex', gap: '15px'
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{index + 1}.</span> 
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}